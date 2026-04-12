# OpenAI Chat CLI

A command-line interface for interacting with OpenAI's Chat API, featuring customizable conversation styles including a unique Zhuge Liang (諸葛亮) persona.

## Features

- **Interactive Chat**: Continuous conversation loop with context preservation
- **Multiple Styles**: Switch between different conversation personas
  - Default: Standard helpful assistant
  - Zhuge Liang: Ancient Chinese strategist with classical language style
- **Multi-language Support**: Traditional Chinese, Simplified Chinese, and English
- **Conversation History**: Maintains context across multiple turns
- **Command Line Arguments**: Flexible configuration via CLI parameters
- **Environment Variables**: Secure API key management

## Prerequisites

- Python 3.7+
- OpenAI API key

## Installation

1. Navigate to the tool directory:
```bash
cd openai-chat-cli
```

2. Install required dependencies:
```bash
pip install -r requirements.txt
```

3. Set up your API key (choose one method):

**Method 1: Environment Variable (Recommended)**
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your-api-key-here"

# Linux/Mac
export OPENAI_API_KEY="your-api-key-here"
```

**Method 2: Command Line Argument**
```bash
python openai-chat.py --api-key "your-api-key-here"
```

**Method 3: Edit Script (Not Recommended for Production)**
Edit `openai-chat.py` and replace `DEFAULT_API_KEY` value.

## Usage

### Basic Usage

Start the chat with default settings:
```bash
python openai-chat.py
```

### Conversation Styles

**Standard Assistant:**
```bash
python openai-chat.py --style default
```

**Zhuge Liang Persona (諸葛亮):**
```bash
python openai-chat.py --style zhugeliang
```

### Language Options

**Traditional Chinese (Default):**
```bash
python openai-chat.py --language zh-TW
```

**Simplified Chinese:**
```bash
python openai-chat.py --language zh-CN
```

**English:**
```bash
python openai-chat.py --language en
```

### Advanced Configuration

**Custom Model:**
```bash
python openai-chat.py --model gpt-4
```

**Custom API Endpoint:**
```bash
python openai-chat.py --base-url "https://your-api-endpoint.com/v1"
```

**Combined Options:**
```bash
python openai-chat.py --style zhugeliang --language zh-TW --model gpt-4o-mini
```

### Interactive Commands

While chatting, use these commands:
- `exit` or `quit` - Exit the program
- `clear` - Clear conversation history and start fresh
- Press `Ctrl+C` - Interrupt and exit

## Configuration

### Default Settings

Edit these constants in `openai-chat.py` to change defaults:

```python
DEFAULT_API_KEY = "your-key"          # Your API key
DEFAULT_BASE_URL = "https://..."      # API endpoint
DEFAULT_MODEL = "gpt-4o-mini"         # Model to use
```

### Available Models

- `gpt-4o-mini` (default, cost-effective)
- `gpt-4o` (more capable)
- `gpt-4-turbo`
- `gpt-3.5-turbo`

Check your API provider for available models.

## Example Session

```
==============================================================
OpenAI Chat CLI - 命令列對話工具
==============================================================
模型：gpt-4o-mini
風格：default
語言：zh-TW

輸入 'exit' 或 'quit' 離開
輸入 'clear' 清除對話歷史
==============================================================

你: 你好，今天天氣如何？

AI: 你好！我無法即時查看天氣資訊，建議您查看當地的天氣預報網站或APP。

你: exit
再見!
```

## About Zhuge Liang Style

The Zhuge Liang persona features:
- Classical Chinese language patterns
- Historical references and idioms
- Strategic and philosophical insights
- Formal address and respectful tone
- Ancient Chinese literary style

This style is based on the historical figure Zhuge Liang (諸葛亮, 181-234 AD), a renowned strategist and statesman during China's Three Kingdoms period.

## API Information

**Free API Source:**
- [ChatAnywhere - Free GPT API](https://github.com/chatanywhere/GPT_API_free)

**Official OpenAI:**
- [OpenAI Platform](https://platform.openai.com/)

## Security Notes

- ⚠️ **Never commit API keys** to version control
- ✅ Use environment variables for sensitive data
- ✅ Consider using `.env` files with `python-dotenv`
- ✅ Rotate keys regularly
- ✅ Monitor API usage and costs

## Troubleshooting

### "Module 'openai' not found"

Install the package:
```bash
pip install openai
```

### "API key not valid"

Check your API key:
1. Verify it's correctly set in environment variable or command line
2. Ensure no extra spaces or quotes
3. Confirm key is active and has credits

### Connection Errors

- Check internet connectivity
- Verify `base_url` is correct
- Check firewall/proxy settings

### Rate Limiting

If you encounter rate limits:
- Wait before retrying
- Use a different API key
- Upgrade your API plan

## Technical Details

- **Language**: Python 3.7+
- **API**: OpenAI Chat Completions API
- **Context Management**: Conversation history maintained in memory
- **Error Handling**: Graceful fallback for API failures

## License

This tool is part of the Script-List project and follows the same MIT License.

## References

- [OpenAI Python Library Documentation](https://github.com/openai/openai-python)
- [Chat Completions API Guide](https://platform.openai.com/docs/guides/chat)
- [ChatAnywhere Free API](https://github.com/chatanywhere/GPT_API_free)
