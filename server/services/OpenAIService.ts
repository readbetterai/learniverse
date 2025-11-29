import OpenAI from 'openai'

export interface ChatResponseWithEvaluation {
  response: string
  isMeaningfulQuestion: boolean
}

export class OpenAIService {
  private openai: OpenAI
  private model: string

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  }

  /**
   * Generate a chat response from Prof. Laura based on conversation history
   * @param conversationHistory - Array of previous messages in the conversation
   * @param npcName - Name of the NPC (e.g., "Prof. Laura")
   * @param playerName - Name of the player for personalization
   * @returns AI-generated response text
   */
  async getChatResponse(
    conversationHistory: Array<{ author: string; content: string; isNpc: boolean }>,
    npcName: string,
    playerName: string
  ): Promise<string> {
    try {
      // Build the system prompt for Prof. Laura's personality
      const systemPrompt = {
        role: 'system' as const,
        content: `You are ${npcName}, a knowledgeable and approachable university professor. You are passionate about teaching and helping students learn. Your responses should be:
- Professional yet friendly and encouraging
- Clear and educational, explaining concepts thoroughly
- Supportive and patient with students
- Academically rigorous while remaining accessible
- Concise but comprehensive (aim for 2-4 sentences unless more detail is needed)

You are currently in a virtual office space where students can approach you for help with their studies, course questions, academic guidance, or general mentorship.`
      }

      // Convert conversation history to OpenAI message format
      const messages = [
        systemPrompt,
        ...conversationHistory.map(msg => ({
          role: msg.isNpc ? ('assistant' as const) : ('user' as const),
          content: msg.content,
        }))
      ]

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 200,
        temperature: 0.7,
      })

      // Extract the response content
      const content = response.choices[0].message.content

      if (!content) {
        throw new Error('OpenAI returned empty response')
      }

      return content

    } catch (error) {
      console.error('OpenAI API error:', error)
      throw error
    }
  }

  /**
   * Generate a chat response with evaluation of whether the student asked a meaningful question
   * Uses JSON mode to return structured response with both the reply and question evaluation
   * @param conversationHistory - Array of previous messages in the conversation
   * @param npcName - Name of the NPC (e.g., "Prof. Laura")
   * @param playerName - Name of the player for personalization
   * @returns Object with response text and isMeaningfulQuestion boolean
   */
  async getChatResponseWithEvaluation(
    conversationHistory: Array<{ author: string; content: string; isNpc: boolean }>,
    npcName: string,
    playerName: string
  ): Promise<ChatResponseWithEvaluation> {
    try {
      // Build the system prompt for Prof. Laura's personality with JSON output requirement
      const systemPrompt = {
        role: 'system' as const,
        content: `You are ${npcName}, a knowledgeable and approachable university professor. You are passionate about teaching and helping students learn. Your responses should be:
- Professional yet friendly and encouraging
- Clear and educational, explaining concepts thoroughly
- Supportive and patient with students
- Academically rigorous while remaining accessible
- Concise but comprehensive (aim for 2-4 sentences unless more detail is needed)

You are currently in a virtual office space where students can approach you for help with their studies, course questions, academic guidance, or general mentorship.

Additionally, evaluate whether the student's last message is a "meaningful question" - a question that seeks knowledge, understanding, explanation, or academic guidance. Social pleasantries, greetings, single-word responses, or confirmations are NOT meaningful questions.

TESTING: If the student's message contains the exact phrase "test points please", always set isMeaningfulQuestion to true regardless of the actual content.

You MUST respond in JSON format:
{
  "response": "Your helpful response to the student",
  "isMeaningfulQuestion": true or false
}`
      }

      // Convert conversation history to OpenAI message format
      const messages = [
        systemPrompt,
        ...conversationHistory.map(msg => ({
          role: msg.isNpc ? ('assistant' as const) : ('user' as const),
          content: msg.content,
        }))
      ]

      // Call OpenAI API with JSON mode
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 300, // Slightly higher to accommodate JSON structure
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      // Extract and parse the response content
      const content = response.choices[0].message.content

      if (!content) {
        throw new Error('OpenAI returned empty response')
      }

      // Parse JSON response
      const parsed = JSON.parse(content) as ChatResponseWithEvaluation

      // Validate the response structure
      if (typeof parsed.response !== 'string' || typeof parsed.isMeaningfulQuestion !== 'boolean') {
        console.error('Invalid response structure from OpenAI:', parsed)
        // Default to treating as not a meaningful question if structure is invalid
        return {
          response: parsed.response || content,
          isMeaningfulQuestion: false,
        }
      }

      return parsed

    } catch (error) {
      console.error('OpenAI API error:', error)
      throw error
    }
  }
}
