export const enum Activation {
    RELU = "relu",
    SIGMOID = "sigmoid",
    SOFTMAX = "softmax",
    LINEAR = "linear",
    TANH = "tanh",
    RELU6 = "relu6",
    ELU = "elu",
    SELU = "selu",
    HARDSIGMOID = "hardSigmoid",
    SOFTPLUS = "softplus",
    SOFTSIGN = "softsign",
    SWISH = "swish",
    MISH = "mish",
}

export const Activations: { [key in Activation]: string } = {
    [Activation.RELU]: "ReLU",
    [Activation.SIGMOID]: "Sigmoid",
    [Activation.SOFTMAX]: "Softmax",
    [Activation.LINEAR]: "Linear",
    [Activation.TANH]: "Tanh",
    [Activation.RELU6]: "ReLU6",
    [Activation.ELU]: "ELU",
    [Activation.SELU]: "SELU",
    [Activation.HARDSIGMOID]: "Hard Sigmoid",
    [Activation.SOFTPLUS]: "Softplus",
    [Activation.SOFTSIGN]: "Softsign",
    [Activation.SWISH]: "Swish",
    [Activation.MISH]: "Mish"
};


export const enum Loss {
    BINARY_CROSS_ENTROPY = "binaryCrossentropy",
    SPARSE_CATEGORICAL_CROSS_ENTROPY = "sparseCategoricalCrossentropy",
    MEAN_SQUARED_ERROR = "meanSquaredError",
    MEAN_ABSOLUTE_ERROR = "meanAbsoluteError",
    MEAN_ABSOLUTE_PERCENTAGE_ERROR = "meanAbsolutePercentageError",
    MEAN_SQUARED_LOG_ERROR = "meanSquaredLogarithmicError",
    HINGE = "hinge",
    SQUARED_HINGE = "squaredHinge",
    CATEGORICAL_HINGE = "categoricalHinge",
    LOG_COSH = "logcosh",
    KL_DIVERGENCE = "kullbackLeiblerDivergence",
    POISSON = "poisson",
    COSINE_PROXIMITY = "cosineProximity",

    // image segmentation only
    DICE_BINARY_CROSS_ENTROPY = "diceBinaryCrossentropy",
    DICE_CATEGORICAL_CROSS_ENTROPY = "diceCategoricalCrossentropy",
    CATEGORICAL_CROSS_ENTROPY = "categoricalCrossentropy"
}


// A mapping of unsupported losses and their serialization placeholder.
// TFJS does not support serialization with custom losses.
// When loading the model, it should be compiled with the original custom
// loss which is found in its ProjectConfig
export const UnsupportedCustomLosses: Loss[] = [
    Loss.DICE_BINARY_CROSS_ENTROPY,
    Loss.DICE_CATEGORICAL_CROSS_ENTROPY
]

export const RemapCustomLosses = {
    [Loss.DICE_BINARY_CROSS_ENTROPY]: Loss.BINARY_CROSS_ENTROPY,
    [Loss.DICE_CATEGORICAL_CROSS_ENTROPY]: Loss.CATEGORICAL_CROSS_ENTROPY,
} satisfies Partial<Record<Loss, string>>


// In order to be serialized with tf.model/tf.sequential,
// the string loss identifier needs to be provided, not tf.losses[...],
// values come from @tensorflow/tfjs-layers/dist/losses.js
export const Losses = {
    [Loss.BINARY_CROSS_ENTROPY]: "Binary Crossentropy",
    [Loss.SPARSE_CATEGORICAL_CROSS_ENTROPY]: "Categorical Crossentropy",
    [Loss.MEAN_SQUARED_ERROR]: "Mean Squared Error",
    [Loss.MEAN_ABSOLUTE_ERROR]: "Mean Absolute Error",
    [Loss.MEAN_ABSOLUTE_PERCENTAGE_ERROR]: "Mean Absolute Percentage Error",
    [Loss.MEAN_SQUARED_LOG_ERROR]: "Mean Squard Logarithmic Error",
    [Loss.HINGE]: "Hinge",
    [Loss.SQUARED_HINGE]: "Squared Hinge",
    [Loss.CATEGORICAL_HINGE]: "Categorical Hinge",
    [Loss.LOG_COSH]: "Log Hyperbolic Cosine",
    [Loss.KL_DIVERGENCE]: "KL Divergence",
    [Loss.POISSON]: "Poisson",
    [Loss.COSINE_PROXIMITY]: "Cosine Proximity"
} satisfies Partial<Record<Loss, string>>


export const LossesSegmentation = {
    [Loss.DICE_BINARY_CROSS_ENTROPY]: "Dice + Binary Crossentropy",
    [Loss.DICE_CATEGORICAL_CROSS_ENTROPY]: "Dice + Categorical Crossentropy",
    [Loss.BINARY_CROSS_ENTROPY]: "Binary Crossentropy",
    [Loss.CATEGORICAL_CROSS_ENTROPY]: "Categorical Crossentropy",
} satisfies Partial<Record<Loss, string>>


export const enum Optimizer {
    ADAM = "adam",
    SGD = "sgd",
    ADAGRAD = "adagrad",
    ADADELTA = "adadelta",
    ADAMAX = "adamax",
    RMSPROP = "rmsprop"
}


export const Optimizers: { [key in Optimizer]: string } = {
    [Optimizer.ADAM]: "Adam",
    [Optimizer.SGD]: "Stochastic Gradient Descent",
    [Optimizer.ADAGRAD]: "Adagrad",
    [Optimizer.ADADELTA]: "Adadelta",
    [Optimizer.ADAMAX]: "Adamax",
    [Optimizer.RMSPROP]: "RMSProp",
};


export const enum Metric {
    ACCURACY = "acc",
    MEAN_SQUARED_ERROR = "mse",
    MEAN_ABSOLUTE_ERROR = "mae",
    MEAN_ABSOLUTE_PERCENTAGE_ERROR = "mape",
    COSINE_PROXIMITY = "cosine",
    SPARSE_CATEGORICAL_CROSS_ENTROPY = "sparseCategoricalCrossentropy",
    RECALL = "recall",
    PRECISION = "precision",
    PERPLEXITY = "perplexity"
}


export const UnsupportedCustomMetrics: Metric[] = [
    Metric.PRECISION,
    Metric.RECALL
];


/**
 * In order to be serializeable with saved tfjs models,
 * a string metric identifier needs to be provided, not tf.metrics[...],
 * values come from @tensorflow/tfjs-layers/dist/metrics.js
 * 
 */
export const Metrics: { [key in Metric | string]: string } = {
    [Metric.ACCURACY]: "Accuracy",
    [Metric.MEAN_SQUARED_ERROR]: "Mean Squared Error",
    [Metric.MEAN_ABSOLUTE_ERROR]: "Mean Absolute Error",
    [Metric.MEAN_ABSOLUTE_PERCENTAGE_ERROR]: "Mean Absolute Percentage Error",
    [Metric.COSINE_PROXIMITY]: "Cosine Proximity",
    [Metric.SPARSE_CATEGORICAL_CROSS_ENTROPY]: "Categorical Crossentropy",

    // custom
    [Metric.PERPLEXITY]: "Perplexity",
    // recall and precision are different from TFJS's because they use rounding
    [Metric.RECALL]: "Recall",
    [Metric.PRECISION]: "Precision"
};


/**
 * Map metrics to their readable shortened name for cases like
 * mse and cosine which are not immediately apparent to users.
 * Use this for display purposes since it includes val_ versions,
 * and `tf_metrics` for actual training logic.
 * 
 * Precision and recall are disabled because they do not handle rounding
 * predictions, so a sigmoid output of 0.99 is not considered 1
*/
export const MetricsLabels: { [key in (Metric | `val_${Metric}`) | "loss" | "val_loss" | string]: string } = {
    [Metric.ACCURACY]: "Accuracy",
    [Metric.MEAN_SQUARED_ERROR]: "Mean Squared Error",
    [Metric.MEAN_ABSOLUTE_ERROR]: "Mean Absolute Error",
    [Metric.MEAN_ABSOLUTE_PERCENTAGE_ERROR]: "Mean Absolute Percentage Error",
    [Metric.COSINE_PROXIMITY]: "Cosine Proximity",
    [Metric.SPARSE_CATEGORICAL_CROSS_ENTROPY]: "Categorical Crossentropy",
    ["loss"]: "Loss",
    [Metric.RECALL]: "Recall",
    [Metric.PRECISION]: "Precision",
    [Metric.PERPLEXITY]: "Perplexity",

    [`val_${Metric.ACCURACY}`]: "Val Accuracy",
    [`val_${Metric.MEAN_SQUARED_ERROR}`]: "Val Mean Squared Error",
    [`val_${Metric.MEAN_ABSOLUTE_ERROR}`]: "Val Mean Absolute Error",
    [`val_${Metric.MEAN_ABSOLUTE_PERCENTAGE_ERROR}`]: "Val Mean Absolute Percentage Error",
    [`val_${Metric.COSINE_PROXIMITY}`]: "Val Cosine Proximity",
    [`val_${Metric.SPARSE_CATEGORICAL_CROSS_ENTROPY}`]: "Val Categorical Crossentropy",
    "val_loss": "Val Loss",
    [`val_${Metric.RECALL}`]: "Val Recall",
    [`val_${Metric.PRECISION}`]: "Val Precision",
    [`val_${Metric.PERPLEXITY}`]: "Val Perplexity"
};


export type Backend = "webgpu" | "webgl" | "cpu";


export const TrainingBackend: { [key in Backend]: string } = {
    webgpu: "WebGPU (GPU)",
    webgl: "WebGL (GPU)",
    cpu: "CPU",
};
