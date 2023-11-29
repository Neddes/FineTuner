<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Table from '$lib/components/ui/table';
	import Label from '$lib/components/ui/label/label.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';

	let response = '';
	let completedResponse = '';
	let systemMessage = 'You are a helpful assistant';
	let userMessage = 'who are you?';
	let stream: ReadableStream | null = null;

	let fineTuneSystemMessage = '';

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

	let fineTuneItems = [
		{
			input: '',
			output: ''
		}
	];

	function addRow() {
		fineTuneItems = [...fineTuneItems, { input: '', output: '' }];
	}
</script>

<div class="hidden h-full flex-col md:flex w-full items-center">
	<div
		class="container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16 max-w-7xl"
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
	<div class="flex flex-row w-full pt-8 max-w-7xl">
		<div class="w-full flex flex-col gap-y-6">
			<div>
				<h3 class="text-lg font-semibold">Your Finetune set</h3>
				<p class="text-slate-600">
					This will create a .jsonl file which you can use to finetune any Chat model. We can help
					you generate synthetic input data. You can change those settings on the right. Click here
					to see how this works.
				</p>
			</div>
			<div class="flex flex-col w-full gap-1.5">
				<Label for="fineTuneSystemMessage">Fine Tune System Message</Label>
				<Textarea
					bind:value={fineTuneSystemMessage}
					placeholder="FineTune System Message"
					id="fineTuneSystemMessage"
					name="fineTuneSystemMessage"
				/>
			</div>
			<div>
				<h3 class="text-lg font-semibold">Your Input & Output Data</h3>
				<p class="text-slate-600">
					Every row in your file will consist of your system message (above, input and output data).
				</p>
			</div>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="border border-gray-300 rounded-tl-lg">Input</Table.Head>
						<Table.Head class="border border-gray-300 rounded-tr-lg">Output</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each fineTuneItems as item}
						<Table.Row>
							<Table.Cell class="border border-gray-300 p-2 ">
								<Textarea
									bind:value={item.input}
									placeholder="Your input data here..."
									class="border-none resize-none"
								/>
							</Table.Cell>
							<Table.Cell class="border border-gray-300">
								<Textarea
									bind:value={item.output}
									placeholder="Your output data here..."
									class="border-none resize-none"
								/>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<Button on:click={addRow}>Add Row</Button>

			<div class="max-w-lg flex flex-col gap-y-4 p-8">
				<Label>{completedResponse}</Label>
				{#if completedResponse}
					<Button on:click={() => (response = '')}>Clear</Button>
				{/if}
			</div>
		</div>
		<div>
			<div class="max-w-lg flex flex-col gap-y-4 p-8 min-w-[480px]">
				<h3 class="text-lg font-semibold">FineTunerGenerate Synthetic Input Data</h3>
				<Textarea bind:value={systemMessage} placeholder="System Message" />
				<Textarea bind:value={userMessage} placeholder="User Message" />

				<Button on:click={generateSyntheticData}>Generate Synthetic Data</Button>
			</div>
		</div>
	</div>
</div>
