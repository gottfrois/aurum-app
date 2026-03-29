import { google } from '@ai-sdk/google'

// Centralized model configuration — change here to swap models for all agents.
export const chatModel = () => google('gemini-2.5-flash-lite')
export const titleModel = () => google('gemini-2.5-flash-lite')
