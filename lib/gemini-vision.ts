import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODELS = {
  'flash': 'gemini-3-flash-preview',
  'pro': 'gemini-3.1-pro-preview'
} as const;

export async function extractQuestionsFromImage(
  base64Image: string,
  mimeType: string,
  modelType: 'flash' | 'pro' = 'flash'
): Promise<string[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS[modelType] });

    const prompt = `Extract all subjective/open-ended questions from this survey document.
Return ONLY a valid JSON array of strings containing the questions, without any markdown formatting or extra text.
Do not include numbering like '1.', '2.', etc. in the strings.

Example: ["What is your favorite subject?", "Who are you closest to?"]`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    try {
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        throw new Error('Response is not a JSON array');
    } catch (parseError) {
        console.error("Failed to parse Gemini response as JSON:", text);
        // Fallback parsing
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('['))
            .map(line => line.replace(/^[\d\.\-\*\"\']+\s*/, '').replace(/[\"\']$/, '').trim());
    }

  } catch (error) {
    console.error('Error in extractQuestionsFromImage:', error);
    throw error;
  }
}

export async function extractAnswersFromImage(
  base64Image: string,
  mimeType: string,
  questions: { id: string, text: string }[],
  modelType: 'flash' | 'pro' = 'flash'
): Promise<Record<string, string>> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS[modelType] });

    const questionsListStr = questions.map((q, i) => `[ID: ${q.id}] ${q.text}`).join('\n');
    
    const prompt = `You are an expert at reading handwritten text from survey forms.
I have provided a student's filled survey form and a list of the exact questions on that form.
Your task is to extract the handwritten answers for each question.

Questions List:
${questionsListStr}

Instructions:
1. Match the handwritten text in the document to the corresponding question.
2. If an answer is blank or illegible, set the value to an empty string "".
3. Return ONLY a valid JSON object where the key is the exact Question ID (e.g., "1234-abcd...") and the value is the extracted handwritten answer string.
4. Do NOT include Markdown formatting (like \`\`\`json) or any extra text.

Example format:
{
  "question-id-1": "This is the handwritten answer",
  "question-id-2": ""
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    try {
        const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        return parsed;
    } catch (parseError) {
        console.error("Failed to parse Gemini response as JSON:", text);
        throw new Error('Could not parse extracted answers properly.');
    }

  } catch (error) {
    console.error('Error in extractAnswersFromImage:', error);
    throw error;
  }
}
