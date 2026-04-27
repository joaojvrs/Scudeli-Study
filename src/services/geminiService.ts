import { GoogleGenAI, Type } from "@google/genai";
import { Question, Material, Flashcard, QuestionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const geminiService = {
  async generateQuestions(subject: string, theme: string, difficulty: string, count: number): Promise<Partial<Question>[]> {
    const prompt = `Generate ${count} multiple-choice medical questions about "${theme}" in the discipline of "${subject}". 
    The difficulty should be "${difficulty}". 
    For each question, provide:
    1. The question text
    2. Four plausible options
    3. The index of the correct answer (0-3)
    4. A detailed explanation of why the answer is correct.
    Return only a JSON array.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              answerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["text", "options", "answerIndex", "explanation"]
          }
        }
      }
    });

    try {
      const results = JSON.parse(response.text || "[]");
      return results.map((r: any) => ({ ...r, type: QuestionType.MULTIPLE_CHOICE }));
    } catch (e) {
      console.error("Failed to parse AI response", e);
      return [];
    }
  },

  async generateQuestionsFromContent(content: string, type: QuestionType, difficulty: string, count: number): Promise<Partial<Question>[]> {
    const typeLabel = type === QuestionType.MULTIPLE_CHOICE ? "multiple-choice" : 
                     type === QuestionType.TRUE_FALSE ? "true/false" : "open-ended (discursiva)";
    
    const formatInstruction = type === QuestionType.OPEN_ENDED 
      ? "For open-ended questions, 'options' should be an empty array and 'answerIndex' should be -1. The 'explanation' should contain the model answer."
      : type === QuestionType.TRUE_FALSE 
      ? "For true/false, 'options' should be ['Verdadeiro', 'Falso'] and 'answerIndex' 0 for True or 1 for False."
      : "For multiple choice, provide 4 options.";

    const prompt = `Based ONLY on the following medical content, generate ${count} ${typeLabel} questions.
    Difficulty level: ${difficulty}.
    Content: ${content.substring(0, 8000)}
    
    ${formatInstruction}
    Provide an explanation base on the text.
    Return only a JSON array.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              answerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["text", "options", "answerIndex", "explanation"]
          }
        }
      }
    });

    try {
      const results = JSON.parse(response.text || "[]");
      return results.map((r: any) => ({ ...r, type }));
    } catch (e) {
      console.error("AI Generation Error:", e);
      return [];
    }
  },

  async summarizeMaterial(content: string): Promise<string> {
    const prompt = `Summarize the following medical study material clearly and professionally. Use bullet points for key concepts. 
    Content: ${content.substring(0, 5000)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Summary could not be generated.";
  },

  async generateFlashcardsFromContent(content: string): Promise<Partial<Flashcard>[]> {
    const prompt = `Create 5 high-quality flashcards based on the following medical content. 
    Each flashcard should have a 'front' (question/concept) and a 'back' (definition/answer).
    Content: ${content.substring(0, 5000)}
    Return only a JSON array.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING }
            },
            required: ["front", "back"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse AI response", e);
      return [];
    }
  },

  async generateStudyPlan(examDate: string, content: string, availability: number): Promise<any[]> {
    const prompt = `Create a detailed daily study plan for a medical student preparing for an exam on ${examDate}.
    Available time per day: ${availability} minutes.
    Topics to cover: ${content}
    
    The plan should alternate between theory, practice (questions), and cumulative reviews.
    Return a JSON array of objects, each with 'date' (YYYY-MM-DD), 'topics' (array of strings), and 'completed' (boolean, default false).`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              topics: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              completed: { type: Type.BOOLEAN }
            },
            required: ["date", "topics", "completed"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Study Plan Generation Error:", e);
      return [];
    }
  }
};
