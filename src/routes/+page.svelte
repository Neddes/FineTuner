<script lang="ts">
	import Badge from '$lib/components/ui/badge/badge.svelte';

	let response = '';
	let completedResponse = '';
	let userMessage = '';
	let stream: ReadableStream | null = null;

	async function sendData() {
		response = '';

		if (stream) {
			stream.cancel();
			stream = null;
		}
		const responseStream = await fetch('/api', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userMessage })
		});

		if (responseStream.body) {
			const reader = responseStream.body.getReader();
			stream = new ReadableStream({
				async start(controller) {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							controller.close();
							break;
						}
						controller.enqueue(value);
						let textChunk = new TextDecoder().decode(value);
						response += textChunk;
						console.log(response);
					}
					completedResponse = response;
					console.log('Completed response:', completedResponse);
				},
				cancel() {
					reader.cancel();
				}
			});

			// Inside your stream processing code
		}
	}
</script>

<Badge class="bg-red-500">Red Badge</Badge>
