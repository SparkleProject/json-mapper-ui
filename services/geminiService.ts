import { GoogleGenAI, Type } from "@google/genai";
import { Mapping } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const flattenKeys = (obj: any, prefix = ''): string[] => {
  let keys: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(flattenKeys(obj[key], prefix + key + '.'));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
};

export const getAutoMappings = async (leftJson: any, rightJson: any): Promise<Mapping[]> => {
  const leftKeys = flattenKeys(leftJson);
  const rightKeys = flattenKeys(rightJson);

  if (leftKeys.length === 0 || rightKeys.length === 0) {
    return [];
  }

  const prompt = `
    I have two lists of JSON keys (paths). 
    Source Keys: ${JSON.stringify(leftKeys)}
    Target Keys: ${JSON.stringify(rightKeys)}
    
    Please identify semantically similar pairs to create a mapping from Source to Target.
    Return a list of pairs. Only map if there is a strong semantic confidence.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mappings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING }
                },
                required: ['source', 'target']
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    if (result.mappings && Array.isArray(result.mappings)) {
        return result.mappings.map((m: any) => ({
            id: `auto-${Math.random().toString(36).substr(2, 9)}`,
            sourcePath: m.source,
            targetPath: m.target
        }));
    }
    return [];

  } catch (error) {
    console.error("Gemini Auto-Map Error:", error);
    throw new Error("Failed to generate mappings with AI.");
  }
};