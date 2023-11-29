<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Avatar from '$lib/components/ui/avatar';

	import Label from '$lib/components/ui/label/label.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';

	let response = '';
	let completedResponse = '';
	let systemMessage = 'You are a helpful assistant';
	let userMessage = 'who are you?';
	let stream: ReadableStream | null = null;

	async function generateSyntheticData() {
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
			body: JSON.stringify({ systemMessage, userMessage })
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

<div class="hidden h-full flex-col md:flex w-full">
	<div
		class="container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16"
	>
		<h2 class="text-lg font-semibold">FineTuner</h2>
		<div class="flex flex-row gap-x-4">
			<Button>Download File</Button>
			<Avatar.Root>
				<Avatar.Fallback>TT</Avatar.Fallback>
			</Avatar.Root>
		</div>
	</div>
	<Separator />
	<div class="flex flex-row w-full">
		<div class="bg-gray-50 w-full">
			<div class="max-w-lg flex flex-col gap-y-4 p-8">
				<Label>{completedResponse}</Label>
				{#if completedResponse}
					<Button on:click={() => (response = '')}>Clear</Button>
				{/if}
			</div>
		</div>
		<div>
			<div class="max-w-lg flex flex-col gap-y-4 p-8 min-w-[480px]">
				<Textarea bind:value={systemMessage} placeholder="System Message" />
				<Textarea bind:value={userMessage} placeholder="User Message" />

				<Button on:click={generateSyntheticData}>Generate Synthetic Data</Button>
			</div>
		</div>
	</div>
</div>
