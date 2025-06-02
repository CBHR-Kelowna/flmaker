
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Listing } from '../types';

// New helper function to get formatted bed/bath string from structured listing data
const getBedBathDisplayInfo = (listing: Listing): { 
  bedBathTextFormatted: string | null; // For direct display e.g., "3 Beds | 2 Baths"
  bedsForPrompt: string; // For AI prompt e.g., "3 Beds" or "Not specified"
  bathsForPrompt: string; // For AI prompt e.g., "2 Baths" or "Not specified"
} => {
  let bedsCount = 0;
  if (listing.BedroomsTotal && listing.BedroomsTotal > 0) {
    bedsCount = listing.BedroomsTotal;
  }

  let totalCalculatedBaths = 0;
  if (listing.BathroomsTotalInteger && listing.BathroomsTotalInteger > 0) {
    totalCalculatedBaths += listing.BathroomsTotalInteger;
  }
  if (listing.BathroomsPartial && listing.BathroomsPartial > 0) {
    // Assuming a partial bath contributes as 1 to the total count of "functional bathrooms"
    // for the "X Baths" style.
    totalCalculatedBaths += listing.BathroomsPartial;
  }

  // If neither beds nor baths are specified with positive counts,
  // assume not primarily residential or info not available.
  if (bedsCount === 0 && totalCalculatedBaths === 0) {
    return { 
      bedBathTextFormatted: null, 
      bedsForPrompt: "Not specified", 
      bathsForPrompt: "Not specified" 
    };
  }

  const bedsStrDisplay = bedsCount > 0 ? `${bedsCount} Bed${bedsCount > 1 ? 's' : ''}` : "";
  const bathsStrDisplay = totalCalculatedBaths > 0 ? `${totalCalculatedBaths} Bath${totalCalculatedBaths > 1 ? 's' : ''}` : "";

  let combinedText: string | null = null;
  if (bedsStrDisplay && bathsStrDisplay) {
    combinedText = `${bedsStrDisplay} | ${bathsStrDisplay}`;
  } else if (bedsStrDisplay) {
    combinedText = bedsStrDisplay;
  } else if (bathsStrDisplay) {
    combinedText = bathsStrDisplay;
  }
  
  return { 
    bedBathTextFormatted: combinedText,
    bedsForPrompt: bedsStrDisplay || "Not specified",
    bathsForPrompt: bathsStrDisplay || "Not specified"
  };
};

export const generateInstagramPostDescription = async (listing: Listing, agentName: string | null): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not configured. Please set it in your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { bedBathTextFormatted, bedsForPrompt, bathsForPrompt } = getBedBathDisplayInfo(listing);
  const address = `${listing.StreetName}, ${listing.City}`; // UnitNumber is not in Listing type

  // Construct the "Property Specifics" part of the prompt dynamically
  let propertySpecificsForPromptSegment = `*   Address: ${address}\n`;
  if (bedBathTextFormatted) {
    propertySpecificsForPromptSegment += `    *   Features: ${bedBathTextFormatted}\n`;
  }
  propertySpecificsForPromptSegment += `    *   Listed by: ${agentName || 'Our Dedicated Team'}`;

  const prompt = `
You are a helpful real estate marketing assistant. Your task is to generate an engaging and concise Instagram post description for the property detailed below.

Follow this structure and tone precisely:

1.  **Introduction Emoji and Question/Statement:** Start with a catchy emoji (e.g., 🏡, ✨, 🔑, 🌊) followed by an intriguing question or a bold statement to grab the reader's attention immediately.
2.  **Detailed Description:** Provide a brief but vivid description of the property, highlighting 2-3 key features or unique selling points from the "Property description from DB". Focus on what makes it special (e.g., views, finishes, lifestyle). Keep this concise.
3.  **Family and Pet Friendliness (Optional but Recommended):** If the "Property description from DB" mentions features suitable for families or pets (e.g., "Pet Friendly", "dog park", "fenced yard", "spacious rooms"), briefly highlight them. If not explicitly mentioned, you can omit this or make a general positive statement if appropriate (e.g., "A wonderful place to call home.").
4.  **Property Specifics (NO EMOJIS HERE):**
    ${propertySpecificsForPromptSegment}
5.  **Call to Action:** Encourage potential buyers to take the next step with a clear and concise call to action. Example: "Ready for a tour? Contact us today!" or "DM for details & showings!"
6.  **Hashtags:** Conclude with 5-7 relevant and effective hashtags. Include general real estate tags, location-specific tags (e.g., #${listing.City.replace(/\s+/g, '')}Living, #${listing.City.replace(/\s+/g, '')}RealEstate), and feature-specific tags if applicable.

**Property Information to Use (for your reference during generation):**

Property Address: "${address}"
Bedrooms: "${bedsForPrompt}" 
Bathrooms: "${bathsForPrompt}"
Agent's Name: "${agentName || 'Our Dedicated Team'}"
City for Hashtags: "${listing.City}"
Property description from DB:
"""
${listing.PublicRemarks}
"""

**Important Instructions:**
-   **Conciseness:** Instagram posts should be easy to read. Aim for an engaging summary, not a full novel.
-   **Emoji Use:** Use emojis thoughtfully at the beginning and possibly in the detailed description for visual appeal. DO NOT use emojis in the "Property Specifics" section.
-   **Tone:** Enthusiastic, inviting, and professional.
-   **Accuracy:** Ensure the address, agent name, and other details are reflected correctly based on the "Property Information to Use" section.
-   **Bed/Bath Handling:** If "Bedrooms" or "Bathrooms" fields in "Property Information to Use" are marked as "Not specified", DO NOT include the "Features" line for bed/bath counts in the "Property Specifics" section of your output. Focus on other aspects of the property if bed/bath information is not applicable.

**Example of a well-formatted output (use this as a guide for structure, conciseness, and tone, but adapt content to the NEW property details provided above):**

🌊 Love the idea of living steps from the beach in the heart of downtown Kelowna?

This fully furnished 1 bed, 1 bath condo at One Water Street offers stunning lake views, high-end finishes, and a rare, spacious floor plan perfect for relaxing or working from home. Enjoy chef-grade KitchenAid appliances, rich hardwood floors, and stylish touches throughout.

Resort-style amenities include two pools, a large fitness centre, yoga studio, oversized hot tub, and The Bench – a private 1.3-acre park with a dog run, BBQs, pickleball, and more. Pet friendly too!

1181 Sunset Drive Unit #1307
1 Bed | 1 Bath
Listed by Amy Essington

Ready to see it in person? Reach out today!

#WeAreKelownaRealEstate #KelownaRealEstate #OneWaterStreet #DowntownKelownaLiving #ColdwellBankerHorizonRealty #LiveWhereYouVacation #PetFriendlyHomes #KelownaCondos #LakeViewLiving #ForSaleKelowna

---
Now, generate the Instagram post for the property with Address: "${address}", City for Hashtags: "${listing.City}", "Property description from DB": "${listing.PublicRemarks}", to be listed by "${agentName || 'Our Dedicated Team'}".
${bedBathTextFormatted ? `The property has features: ${bedBathTextFormatted}.` : 'For this property, bed and bath counts are either not specified or may not be applicable (e.g., vacant land). If so, do not mention beds or baths in the "Property Specifics" section of your output.'}
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate description: ${error.message}`);
    }
    throw new Error("Failed to generate description due to an unknown error.");
  }
};
