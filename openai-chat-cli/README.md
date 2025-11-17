# OpenAI Chat CLI (Minimal)

A super-lightweight command-line script:
- Single file `openai-chat.py`
- Built-in Execute Copilot prompt (restate goal → steps → risks)
- Each question triggers one OpenAI Chat Completion response in Traditional Chinese
- Type `exit`/`quit` or press `Ctrl+C` to leave

## Usage

1. Install dependencies:
```bash
pip install openai
```

2. Run the script:
```bash
python openai-chat.py
```

3. If no API key is set, the script will prompt you to enter it directly.

**Alternative setup methods (optional):**

**Method 1: Environment variable**
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your-api-key"

# Linux/Mac
export OPENAI_API_KEY="your-api-key"
```

**Method 2: Command-line argument**
```bash
python openai-chat.py --api-key="your-api-key"
```

## Environment Variables

- `OPENAI_API_KEY` (required): OpenAI API key
- `OPENAI_BASE_URL` (optional): Defaults to `https://api.chatanywhere.tech/v1`
- `OPENAI_MODEL` (optional): Defaults to `gpt-4o-mini`

## Security
Do not commit real API keys. Prefer environment variables or secret managers in production.
