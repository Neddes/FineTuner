// src/routes/api/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { createParser, type ParsedEvent, type ReconnectInterval } from 'eventsource-parser';
import { OPENAI_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	// This would be where you can handle the incoming request
	// For example, you might want to process the data sent in `request.body`

	// In this mock scenario, we're going to stream back 'lorem ipsum' text
	const { systemMessage, userMessage, output } = await request.json();

	// console log all 3 variables
	console.log('systemMessage:', systemMessage);
	console.log('userMessage:', userMessage);
	console.log('ouput:', output);

	const messages = [
		{
			role: 'system',
			content: systemMessage
		},
		{
			role: 'user',
			content: `${userMessage} 
			Output message:"""
			${output}"""
			`
		}
	];

	const payload = {
		model: 'gpt-3.5-turbo-1106',
		messages,
		stream: true,
		temperature: 0.4
	};

	console.log('Payload:', payload);

	const stream = await OpenAIStream(payload);
	return new Response(stream);
};

interface OpenAIStreamPayload {
	model: string;
	messages: { role: string; content: string }[];
	stream: boolean;
}

async function OpenAIStream(payload: OpenAIStreamPayload) {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	let counter = 0;

	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${OPENAI_API_KEY}`
		},
		method: 'POST',
		body: JSON.stringify(payload)
	});

	const stream = new ReadableStream({
		async start(controller) {
			function onParse(event: ParsedEvent | ReconnectInterval) {
				if (event.type === 'event') {
					const data = event.data;

					if (data === '[DONE]') {
						console.log('\nResponse is done!');
						controller.close();
						return;
					}

					try {
						const json = JSON.parse(data);
						const text = json.choices[0].delta.content || '';
						if (text !== undefined) {
							process.stdout.write(text); // Write text to console without breaking line only if text is not undefined
						}
						// console.log(text);
						if (counter < 2 && (text.match(/\n/) || []).length) {
							// this is a prefix character (i.e., "\n\n"), do nothing
							return;
						}

						const queue = encoder.encode(text);
						controller.enqueue(queue);
						counter++;
					} catch (e) {
						console.log(e);
						controller.error(e);
					}
				}
			}

			// stream response (SSE) from OpenAI may be fragmented into multiple chunks
			// this ensures we properly read chunks and invoke an event for each SSE event stream
			const parser = createParser(onParse);
			// https://web.dev/streams/#asynchronous-iteration
			for await (const chunk of res.body as any) {
				parser.feed(decoder.decode(chunk));
			}
		}
	});
	return stream;
}
