# My Designer

My Designer is a local, no-build web app. It uses Node.js built-ins only; no npm packages are required.

The interface uses the supplied Pin ’n Pitch logo and dark orange glass theme.

## Start the app

1. Install Node.js if `node --version` does not work.
2. In this folder, run `node server.js`.
3. Open [http://localhost:4173](http://localhost:4173).

The editor and demo generator work without an API key. Demo generation creates local illustrative artwork from the brief and places it in an editable image layer; it does not call an AI service. Projects autosave in this browser on this computer; use the small dropdown beside the project name to reopen a saved project.

## Enable AI generation

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey), then copy `.env.example` to `.env`.
2. Change `AI_PROVIDER=demo` to `AI_PROVIDER=gemini` and put the key after `GEMINI_API_KEY=`.
3. Restart `node server.js`, then refresh the app.

The default Gemini model is Nano Banana 2 (`gemini-3.1-flash-image`). The key stays on the Node server and is never sent to the browser. Each Generate request sends the brief and uploaded reference images to Gemini; its output is added as a separate editable image layer while copy and logos remain separately editable. Gemini image generation has no free API tier; check Google's current pricing before enabling it. You can use `AI_PROVIDER=openai` and `OPENAI_API_KEY` instead.

## Connect local Ollama

The server can use Ollama for text-based art direction. This is separate from image generation: Ollama's chat endpoint returns a design concept, while the existing demo/Gemini/OpenAI paths produce the canvas image layer.

1. Install and start Ollama on the same computer as the Node server.
2. Confirm the models with `ollama list` (for example `qwen3:4b` and `qwen2.5:3b`).
3. Copy `.env.example` to `.env` and set:
   ```env
   AI_PROVIDER=ollama
   OLLAMA_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen3:4b
   ```
4. Restart `node server.js`. The app can retrieve installed model names from `/api/ollama/models`.

**Important:** a hosted Render instance cannot reach Ollama on your personal computer through `127.0.0.1`. For a public deployment, use an Ollama server reachable from the Render service over a secured network, or keep AI processing local. Do not expose an unauthenticated Ollama port to the public internet.

## Private investor preview

The Render Blueprint in `render.yaml` runs the demo generator and requires a password. Deploy it as a new Blueprint from a **private source repository**. During setup, set the secret `DEMO_PASSWORD` in Render; `PRIVATE_DEMO=true` is already enabled. Share the generated `onrender.com` URL and the access code with the investor separately. The source is not hosted in the existing public `pin-pitch` repository.

The app's login gate protects the editor and API with an HttpOnly signed session cookie and throttles repeated incorrect codes. Projects remain in each visitor's browser storage; the demo server does not store visitor projects. Render's free web services sleep after 15 minutes without traffic and can take about a minute to wake up.

Do not commit `.env` or put an access code into the URL. For a lasting private preview, use a strong unique code and send it through a separate channel.

## Editor controls

- Select and drag canvas elements to move them; drag the purple corner handle to resize.
- Use the `+` and `−` controls or Ctrl/⌘ + mouse wheel to zoom; the fit button returns to 100%. Choose Shape, then click the canvas to place a shape.
- Double-click editable text to change it. Use the Type tool or `＋` in Layers to add text.
- Upload images in Design direction or Typography to use them as AI references. Upload a logo in Brand details to add it as a canvas layer and AI reference.
- Drag layer cards to reorder them, click the eye to hide/show, and select a layer to edit it. Select an object and press Delete to remove it.
- Brightness and contrast sliders apply to the canvas preview. `Ctrl+S` saves immediately; the app also saves changes automatically.
- Export downloads the current design as a PNG.
