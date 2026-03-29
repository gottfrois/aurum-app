import agent from '@convex-dev/agent/convex.config.js'
import resend from '@convex-dev/resend/convex.config.js'
import stripe from '@convex-dev/stripe/convex.config.js'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(agent)
app.use(resend)
app.use(stripe)

export default app
