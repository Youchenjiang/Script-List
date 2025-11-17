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

3. If no API key is set, the script will prompt you to enter it directly in the terminal.

**Optional: Use environment variable**
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your-api-key"

# Linux/Mac
export OPENAI_API_KEY="your-api-key"
```

## Environment Variables (Optional)

- `OPENAI_API_KEY`: If set, the script will use it directly without prompting
- `OPENAI_BASE_URL`: Defaults to `https://api.chatanywhere.tech/v1`
- `OPENAI_MODEL`: Defaults to `gpt-4o-mini`

## Security
Do not commit real API keys. Prefer environment variables or secret managers in production.
