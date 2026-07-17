/**
 * Service to send formatted error logs directly to a Discord Webhook channel.
 */

export async function sendErrorToDiscord(error, context = {}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const stack = error.stack ? error.stack.slice(0, 1000) : 'No stack trace available';
  const environment = process.env.NODE_ENV || 'development';

  const embed = {
    title: `🚨 Unhandled Server Error [${environment.toUpperCase()}]`,
    color: 15158332, // Red embed color
    fields: [
      { name: 'Error Type', value: error.name || 'Error', inline: true },
      { name: 'Error Message', value: error.message || 'No message provided', inline: true },
      { name: 'Source Context', value: context.context || 'Express Middleware', inline: true },
    ],
    description: `**Stack Trace:**\n\`\`\`javascript\n${stack}\n\`\`\``,
    timestamp: new Date().toISOString(),
  };

  // Add path and method fields if error occurred during an HTTP request
  if (context.path) {
    embed.fields.push({ name: 'Request Path', value: context.path, inline: true });
  }
  if (context.method) {
    embed.fields.push({ name: 'HTTP Method', value: context.method, inline: true });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      console.error(`Discord webhook returned status ${response.status}`);
    }
  } catch (err) {
    console.error('Failed to send error alert to Discord Webhook:', err);
  }
}
