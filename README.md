# </u>[Stellarapp](https://stellarapp.net)</u>
## Create and Run AI in the Browser
Train and run AI models in your browser. No code, no debugging, just model design. Everything stays on your device.

<u>[Stellarapp](https://stellarapp.net)</u> guarantees the safety of your training data by never uploading it in the first place. But if you want full control, you can fire up a local version of [Stellarapp](https://stellarapp.net).


## Getting Started

Requirements
- [Node.js](https://nodejs.org/en/download)
- [Git](https://git-scm.com/install/)

Clone the repository

```
git clone https://github.com/rkuang9/stellarapp.git
```

Install all packages

```
cd stellarapp

npm install
```

Start the server

```
# development server
npm run dev

# production server
npm run build && npm start
```

Open the local web page at [`http://localhost:3000`](http://localhost:3000)

## Jest Unit Testing
This project uses Jest for unit testing. To run the tests, use

```
npm test
```

## Playwright E2E Testing
This project uses Playwright for end-to-end testing. Install the extension [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright), then the test browsers

```
npx playwright install
```

Run the tests via the VSCode testing panel

## Creating Custom Models
Stellarapp uses [`@stellarapp/tfjs-stellar`](https://github.com/rkuang9/tfjs-stellar) to implement LLMs. You can use it interoperably with [`@tensorflow/tfjs`](https://github.com/tensorflow/tfjs) to create your own GPT-like or Llama-like model class. The web app utilizes web workers to train models and avoid locking the web interface.

1. Create a new `web worker` and `client` in the `src/lib/webworker` folder (recommended to copy and modify `gpt_client.ts` and `gpt_worker.ts`)
2. In `src/features/training/gpt` swap out all instances of `GPTModelWorker` and its imports with your worker client

To create your own model class, extend the `tfs.models.LlmModel` class. See the [`GptModel`](https://github.com/rkuang9/tfjs-stellar/blob/main/src/models/gpt_model.ts) class as an example (remember to `tf.serialization.registerClass` your class).
