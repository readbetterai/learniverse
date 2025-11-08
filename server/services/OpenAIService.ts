import OpenAI from 'openai'

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
}
