"""Trains the JeevanSetu wound analyzer with the protocol in Table V of the paper.

Expected layout (the public AZH wound dataset, official split):
    DATA/train/{diabetic,pressure,surgical,venous}/*.jpg
    DATA/test/{diabetic,pressure,surgical,venous}/*.jpg

    pip install -e ".[ml]"
    python ml/train_mobilenetv2.py --data /path/to/AZH --out ml/weights/mobilenetv2_azh.pt
"""

import argparse
import random
import time
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

CLASSES = ("diabetic", "pressure", "surgical", "venous")
MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def stratified_split(targets: list[int], fraction: float, seed: int) -> tuple[list[int], list[int]]:
    rng = np.random.default_rng(seed)
    train, val = [], []
    for cls in sorted(set(targets)):
        idx = [i for i, t in enumerate(targets) if t == cls]
        rng.shuffle(idx)
        cut = round(len(idx) * fraction)
        val += idx[:cut]
        train += idx[cut:]
    return train, val


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray, k: int) -> float:
    scores = []
    for c in range(k):
        tp = np.sum((y_pred == c) & (y_true == c))
        fp = np.sum((y_pred == c) & (y_true != c))
        fn = np.sum((y_pred != c) & (y_true == c))
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        scores.append(2 * p * r / (p + r) if p + r else 0.0)
    return float(np.mean(scores))


@torch.no_grad()
def predict(model: nn.Module, loader: DataLoader) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    probs, labels = [], []
    for x, y in loader:
        probs.append(torch.softmax(model(x), dim=1))
        labels.append(y)
    return torch.cat(probs).numpy(), torch.cat(labels).numpy()


def run_epochs(model, loader, val_loader, optimizer, criterion, epochs, patience, state) -> None:
    stale = 0
    for epoch in range(epochs):
        model.train()
        for x, y in loader:
            optimizer.zero_grad()
            criterion(model(x), y).backward()
            optimizer.step()
        probs, labels = predict(model, val_loader)
        f1 = macro_f1(labels, probs.argmax(1), len(CLASSES))
        print(f"  epoch {epoch + 1}: val macro-F1 {f1:.3f}")
        if f1 > state["best_f1"]:
            state.update(best_f1=f1, best=dict((k, v.clone()) for k, v in model.state_dict().items()))
            stale = 0
        else:
            stale += 1
            if patience and stale >= patience:
                print("  early stop")
                return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--out", default=Path("ml/weights/mobilenetv2_azh.pt"), type=Path)
    parser.add_argument("--seed", default=42, type=int)
    args = parser.parse_args()
    set_seed(args.seed)
    torch.set_num_threads(1)

    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(0.2, 0.2, 0.2),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    eval_tf = transforms.Compose([transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])

    base = datasets.ImageFolder(args.data / "train")
    assert tuple(base.classes) == CLASSES, f"class folders must be {CLASSES}, found {base.classes}"
    train_idx, val_idx = stratified_split(base.targets, 0.15, args.seed)
    train_set = Subset(datasets.ImageFolder(args.data / "train", train_tf), train_idx)
    val_set = Subset(datasets.ImageFolder(args.data / "train", eval_tf), val_idx)
    test_set = datasets.ImageFolder(args.data / "test", eval_tf)
    print(f"train {len(train_set)}, validation {len(val_set)}, test {len(test_set)}")

    train_loader = DataLoader(train_set, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=64)
    test_loader = DataLoader(test_set, batch_size=64)

    # Eq. (3): w_k = N / (K N_k)
    counts = np.bincount([base.targets[i] for i in train_idx], minlength=len(CLASSES))
    weights = torch.tensor(counts.sum() / (len(CLASSES) * counts), dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=weights)

    model = timm.create_model("mobilenetv2_100", pretrained=True, num_classes=len(CLASSES), drop_rate=0.2)
    head = set(id(p) for p in model.get_classifier().parameters())
    state = {"best_f1": -1.0, "best": None}
    started = time.time()

    print("Stage 1: backbone frozen, head only")
    for p in model.parameters():
        p.requires_grad = id(p) in head
    run_epochs(model, train_loader, val_loader, torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=1e-3), criterion, 5, 0, state)

    print("Stage 2: last 30% of parameter tensors unfrozen")
    params = list(model.parameters())
    for p in params[int(len(params) * 0.7):]:
        p.requires_grad = True
    model.load_state_dict(state["best"])
    run_epochs(model, train_loader, val_loader, torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=1e-4), criterion, 12, 4, state)

    model.load_state_dict(state["best"])
    val_probs, _ = predict(model, val_loader)
    tau = float(np.percentile(val_probs.max(1), 15))
    test_probs, test_labels = predict(model, test_loader)
    pred = test_probs.argmax(1)
    answered = test_probs.max(1) >= tau
    print(f"trained in {(time.time() - started) / 60:.1f} min")
    print(f"test accuracy {np.mean(pred == test_labels):.3f}, macro-F1 {macro_f1(test_labels, pred, len(CLASSES)):.3f}")
    print(f"tau {tau:.2f}: coverage {answered.mean():.3f}, selective accuracy {np.mean(pred[answered] == test_labels[answered]):.3f}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "classes": list(CLASSES), "tau": tau, "version": "1"}, args.out)
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
