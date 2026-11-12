"""MobileNetV2 wound classifier with Grad-CAM (sections IV-D and VI of the paper).

Needs the optional ML dependencies (pip install -e ".[ml]") and a checkpoint
written by ml/train_mobilenetv2.py.
"""

from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from app.features.images.analyzer import WOUND_CLASSES, AnalysisResult, apply_threshold, overlay_heatmap

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class MobileNetV2Analyzer:
    name = "mobilenetv2_azh"

    def __init__(self, weights_path: str, tau: float):
        path = Path(weights_path)
        if not path.is_file():
            raise FileNotFoundError(f"no checkpoint at {path}")
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
        self.classes = tuple(checkpoint.get("classes", WOUND_CLASSES))
        self.tau = float(checkpoint.get("tau", tau))
        self.version = str(checkpoint.get("version", "1"))
        self.model = timm.create_model("mobilenetv2_100", pretrained=False, num_classes=len(self.classes), drop_rate=0.2)
        self.model.load_state_dict(checkpoint["state_dict"])
        self.model.eval()
        torch.set_num_threads(1)
        self.transform = transforms.Compose(
            [
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )
        # Last convolutional block; gives the 7 x 7 map used for Grad-CAM.
        self.target_layer = self.model.conv_head

    def analyze(self, image: Image.Image) -> AnalysisResult:
        captured: dict[str, torch.Tensor] = {}

        def forward_hook(_module, _inputs, output):
            captured["activations"] = output
            output.register_hook(lambda grad: captured.__setitem__("gradients", grad))

        handle = self.target_layer.register_forward_hook(forward_hook)
        try:
            x = self.transform(image).unsqueeze(0)
            logits = self.model(x)
            probabilities = F.softmax(logits, dim=1)[0]
            top = int(probabilities.argmax())
            logits[0, top].backward()
        finally:
            handle.remove()
            self.model.zero_grad(set_to_none=True)

        # Eq. (5): alpha_k = mean gradient per channel, M = ReLU(sum_k alpha_k A^k).
        activations = captured["activations"][0].detach()
        gradients = captured["gradients"][0].detach()
        weights = gradients.mean(dim=(1, 2))
        cam = F.relu((weights[:, None, None] * activations).sum(dim=0)).numpy()
        if cam.max() > 0:
            cam = cam / cam.max()

        prediction, confidence, abstained = apply_threshold(probabilities.detach().tolist(), self.classes, self.tau)
        return AnalysisResult(prediction, confidence, abstained, overlay_heatmap(image, np.asarray(cam)))
