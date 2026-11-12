Put the trained checkpoint here as `mobilenetv2_azh.pt` (written by `ml/train_mobilenetv2.py`).

Without it the API still accepts photos, runs the quality gate and stores them,
but marks them "not analysed". Nothing else in the system depends on the model.
