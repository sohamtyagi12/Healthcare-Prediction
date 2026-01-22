
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, LabReportSummary, UserProfile } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const analyzeSymptoms = async (symptoms: string, profile?: UserProfile): Promise<AnalysisResult> => {
  const ai = getAI();
  const context = profile ? `Patient Profile: ${profile.age}yo ${profile.gender}, weight ${profile.weight}, height ${profile.height}. Allergies: ${profile.allergies}. History: ${profile.medicalHistory}.` : "";
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `${context}\nAnalyze these symptoms: ${symptoms}. Respond in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          condition: { type: Type.STRING },
          probability: { type: Type.NUMBER },
          urgency: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Emergency'] },
          description: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          caveats: { type: Type.STRING }
        },
        required: ['condition', 'probability', 'urgency', 'description', 'recommendations', 'caveats']
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const analyzeLabReport = async (base64Image: string, profile?: UserProfile): Promise<LabReportSummary> => {
  const ai = getAI();
  const context = profile ? `Patient Profile: ${profile.age}yo ${profile.gender}. History: ${profile.medicalHistory}.` : "";
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: `${context}\nExtract and interpret clinical lab data. Identify abnormal values.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          parameters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                status: { type: Type.STRING, enum: ['Normal', 'Abnormal', 'Warning'] },
                notes: { type: Type.STRING }
              }
            }
          },
          overallHealthScore: { type: Type.NUMBER },
          interpretation: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const findSpecializedCare = async (specialization: string, lat: number, lng: number): Promise<{text: string, links: any[]}> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find highly-rated ${specialization} doctors, clinics, and hospitals near my location. Include contact details if possible.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: { latitude: lat, longitude: lng }
        }
      }
    }
  });

  return {
    text: response.text || '',
    links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};
