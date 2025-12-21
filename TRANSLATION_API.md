# DeepL Translation API

This custom translation API provides DeepL integration for translating content between English and Traditional Chinese in Strapi v5.

## Setup

1. **Environment Variables**: Add to your `.env` file:
   ```
   DEEPL_API_KEY=your-deepl-api-key-here
   DEEPL_API_URL=https://api-free.deepl.com  # Optional: for free plan, omit for paid plan
   ```

2. **Get DeepL API Key**: Sign up at https://www.deepl.com/pro#developer

## API Endpoints

### 1. Translate Text

**Endpoint**: `POST /api/translate/text`

**Request Body**:
```json
{
  "text": "Hello, how are you?",
  "sourceLang": "en",
  "targetLang": "zh-TW"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "original": "Hello, how are you?",
    "translated": "你好，你好嗎？",
    "sourceLang": "en",
    "targetLang": "zh-TW"
  }
}
```

### 2. Translate Content Entry

**Endpoint**: `POST /api/translate/entry`

**Request Body**:
```json
{
  "contentType": "api::article.article",
  "entryId": 1,
  "sourceLocale": "en",
  "targetLocale": "zh-TW",
  "fields": ["title", "content", "description"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "title": "翻譯後的標題",
    "content": "翻譯後的內容",
    "description": "翻譯後的描述"
  }
}
```

## Language Codes

- **English**: `en`, `EN`, `en-US`
- **Traditional Chinese**: `zh-TW`, `zh`

## Usage Examples

### Using cURL

```bash
# Translate text
curl -X POST http://localhost:1337/api/translate/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, world!",
    "sourceLang": "en",
    "targetLang": "zh-TW"
  }'
```

### Using JavaScript/TypeScript

```javascript
// Translate text
const response = await fetch('http://localhost:1337/api/translate/text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Hello, world!',
    sourceLang: 'en',
    targetLang: 'zh-TW',
  }),
});

const result = await response.json();
console.log(result.data.translated);
```

## Notes

- The translation API supports bidirectional translation (English ↔ Traditional Chinese)
- For content entries, ensure i18n is enabled for your content types
- The API automatically handles locale code mapping between Strapi and DeepL formats

