export enum ProjectType {
    TABULAR_REGRESSION = "tabular_regression",
    TEXT_CLASSIFICATION = "text_classification",
    //OBJECT_DETECTION = "object_detection",
    IMAGE_CLASSIFICATION = "image_classification",
    TEXT_GENERATION = "text_generation",
    IMAGE_SEGMENTATION = "image_segmentation",
}


export const ProjectTypes: { [key: string]: { label: string, available: boolean, description: string } } = {
    [ProjectType.TEXT_GENERATION]: {
        label: "Text Generation",
        available: true,
        description: "Train an LLM on Wiki articles, unstructured text, and instruction-following datasets to learn to generate text and answer questions.",
    },
    [ProjectType.TABULAR_REGRESSION]: {
        label: "Tabular Regression",
        available: true,
        description: "Learn patterns and trends from tabular data to predict numerical values.",
    },
    [ProjectType.TEXT_CLASSIFICATION]: {
        label: "Text Classification",
        available: false,
        description: "Categorize text into predetermined categories (e.g. sentiment classification).",
    },
    [ProjectType.IMAGE_CLASSIFICATION]: {
        label: "Image Classification",
        available: true,
        description: "Categorize images into predetermined categories based on its contents.",
    },
    [ProjectType.IMAGE_SEGMENTATION]: {
        label: "Image Segmentation",
        available: true,
        description: "Identify object shapes, locations, and boundaries within an image at the pixel level.",
    },
}


export default ProjectTypes;


export const ModelJsonName = "model.json";
export const WeightsBinName = "model.weights.bin";
export const ProjectFolderZipName = "project";


export const HyperparameterInfo = {
    learning_rate: {
        title: "Learning rate",
        description: "The rate at which the model's parameters are updated after training on one batch of inputs.\n\nThe learning rate can be changed during training."
    },
    epochs: {
        title: "Training epochs",
        description: "The number of training passes through the dataset. You may opt to stop mid-training and resume with a new epoch. Too many epochs may result in overfitting (memorization).",
    },
    batch_size: {
        title: "Batch size",
        description: "The number of sentences to train on at a time. Ensure your device has enough memory to support a large batch size.\n\nCommon batch sizes are powers of 2, e.g., 4, 8, 16, 32, 64.\n\nThe batch size can be changed during training."
    },
    loss_function: {
        title: "Loss function",
        description: `A measure of the difference between model's prediction and the actual value. Certain loss functions are better suited to specific tasks:\n\n${["1. Binary crossentropy for true/false prediction", "2. Mean squared error for linear regression", "3. Categorical crossentropy for multi-class prediction"].join("\n")}\n\nChanging the loss function requires a model retrain.`
    },
    optimizer: {
        title: "Optimizer",
        description: "The algorithm used to update the model's parameters to minimize the loss function.\n\nChanging the optimizer requires a model retrain."
    },
    metrics: {
        title: "Metrics (optional)",
        description: "A measure of the difference between model's prediction and the actual value. Unlike the loss function, metrics are purely indicators of model performance and do not affect the model's training."
    },
    validation_split: {
        title: "Validation split",
        description: "A portion of the dataset reserved for evaluating how well the model generalizes on unseen data, done at the end of each epoch. Along with metrics, this is used to monitor training progress and guide hyperparameter tuning."
    },
}


export const HyperparameterError = {
    learning_rate: "Learning rate should be greater than 0",
    epochs: "Epochs should be at least 1",
    batch_size: "Batch size should be at least 1",
    validation_split: "Choose a different validation split ratio"
}
