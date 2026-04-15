import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { ProviderOptions } from '@ai-sdk/provider-utils'

// Centralized model configuration — change here to swap models for all agents.

export const chatModel = () => anthropic('claude-opus-4-6')

export const titleModel = () => google('gemini-2.5-flash-lite')

/** Structured-output model used by the ask-AI filter parser (transactions page, etc.). */
export const filterModel = () => google('gemini-2.5-flash')

/** Provider options to disable thinking for the title model. Update when swapping titleModel provider. */
export const titleModelProviderOptions: ProviderOptions = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
}
