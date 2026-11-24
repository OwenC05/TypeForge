"""Fit validation-selected sparse Ridge models and score their folded coefficients."""

from typing import TYPE_CHECKING, TypedDict, cast

from .config import ALPHAS
from .features import NAMES, PAIR_NAMES, DesignMatrix, features
from .metrics import score
from .parity import parity_inputs
from .parse import occurrences

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray
    from scipy.sparse import csr_matrix


class RidgeModel(TypedDict):
    """Fitted intercept and folded weights in feature order, on the natural-log-ms scale."""

    alpha: float
    maeMs: float
    coefficients: list[float]
    intercept: float
    parityPredictions: list[float]


class RidgeScore(TypedDict):
    """One named Ridge variant's validation MAE in milliseconds at the specified alpha."""

    name: str
    alpha: float
    maeMs: float


def predict(model: RidgeModel, x: "csr_matrix") -> "NDArray[np.float64]":
    """Predict natural-log milliseconds on unscaled features using the folded model."""
    import numpy as np

    return x @ np.array(model["coefficients"]) + model["intercept"]


def fit_ridge_models(
    training: DesignMatrix, validation: DesignMatrix, population: float
) -> tuple[dict[str, RidgeModel], list[RidgeScore]]:
    """Fit the no-history and full models on train, selecting each alpha on validation only."""
    import numpy as np
    from scipy.sparse import csr_matrix
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler(with_mean=False).fit(training.x)
    # With sparse CSR inputs and no centering, transform also returns CSR.
    train_x = cast("csr_matrix", scaler.transform(training.x))
    validation_x = cast("csr_matrix", scaler.transform(validation.x))
    scales = np.asarray(scaler.scale_)
    fixture_x = csr_matrix(
        [
            features(prompt, position, history, population)
            for prompt, history in parity_inputs()
            for position, _, _, _ in occurrences(prompt)
        ]
    )
    fixture_x = cast("csr_matrix", scaler.transform(fixture_x))
    models: dict[str, RidgeModel] = {}
    scores: list[RidgeScore] = []
    for name, width in [("ridge-no-history", len(PAIR_NAMES) + 2), ("ridge", len(NAMES))]:
        for alpha in ALPHAS:
            estimator = Ridge(alpha=alpha, solver="lsqr", tol=1e-6)
            estimator.fit(train_x[:, :width], training.y)
            prediction = estimator.predict(validation_x[:, :width])
            mae = score(validation.y, prediction, validation.info)
            if mae is None:
                raise ValueError("Empty usable validation split")
            scores.append({"name": name, "alpha": alpha, "maeMs": mae})
            if name not in models or mae < models[name]["maeMs"]:
                weights = (estimator.coef_ / scales[:width]).tolist()
                models[name] = {
                    "alpha": alpha,
                    "maeMs": mae,
                    "coefficients": weights + [0.0] * (len(NAMES) - width),
                    "intercept": float(estimator.intercept_),
                    "parityPredictions": estimator.predict(fixture_x[:, :width]).tolist(),
                }
    return models, scores
