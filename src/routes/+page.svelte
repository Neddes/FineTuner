<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Table from '$lib/components/ui/table';
	import Label from '$lib/components/ui/label/label.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import { onMount } from 'svelte';

	import Papa from 'papaparse';

	let response = '';
	let completedResponse = '';
	let systemMessage = 'You are a helpful assistant';
	let userMessage = 'Just reply with the output message in dutch.';
	let stream: ReadableStream | null = null;

	let fineTuneSystemMessage = '';

	let errorMessage = '';

	let selectedFile: File | null = null;
	let fileInput: any;
	let fileData: any;
	let filename: string | null = null;
	let parsedDataSuccesfully = false;
	let processedFileUrl: string | null = null;

	let parsedData: Record<string, string>[] = [];
	let headers: string[] = [];

	const requiredHeaders = ['input', 'output'];

	const handleFileUpload = async (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			selectedFile = input.files[0];
			try {
				await handleFile();
				setCSVDataAsFineTuneItems();
			} catch (error) {
				console.error('Error handling file:', error);
			}
		}
	};

	function setCSVDataAsFineTuneItems() {
		// create a fineTuneItem for each row in the parsedData array

		fineTuneItems = parsedData.map((row) => ({
			systemMessage: fineTuneSystemMessage,
			pairs: [
				{
					input: row.input,
					output: row.output
				}
			]
		}));
	}

	function handleFile() {
		return new Promise<void>((resolve, reject) => {
			if (!selectedFile) {
				reject('No file selected');
				return;
			}

			Papa.parse(selectedFile, {
				complete: function (results: any) {
					parseCSV(results.data);
					if (fileData) {
						parsedDataSuccesfully = true;
						resolve();
					} else {
						reject('Error parsing data');
					}
				},
				header: true,
				skipEmptyLines: true,
				dynamicTyping: true
			});
		});
	}

	const parseCSV = (rows: any) => {
		// Check if the required headers are present
		const allHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
		const missingHeaders = requiredHeaders.filter((rh) => !allHeaders.includes(rh));

		if (missingHeaders.length > 0) {
			// throw basic alert error message:
			// just window browser allert:
			alert(`The following headers are missing: ${missingHeaders.join(', ')}`);
			return;
		}

		// Map each row to an object containing only the required headers
		parsedData = rows;
		headers = allHeaders;
		fileData = parsedData;
		if (!fileData) {
			alert(`Something went wrong while parsing the file`);

			return;
		}
	};

	function triggerFileInput() {
		if (fileInput) {
			fileData = null;
			processedFileUrl = null;
			parsedDataSuccesfully = false;
			parsedData = [];
			headers = [];
			filename = null;
			fileInput.value = '';
		}

		fileInput.click(); // Trigger the hidden file input
	}

	async function generateSyntheticData() {
		if (stream) {
			stream.cancel();
			stream = null;
		}

		errorMessage = '';

		// Create a map to store the indices of updated items and their parent fineTuneItems
		let indicesMap = new Map();

		// Iterate over each fineTuneItem and its items to find those that need to be updated
		fineTuneItems.forEach((fineTuneItem, parentIndex) => {
			fineTuneItem.pairs.forEach((item, itemIndex) => {
				if (item.output && !item.input) {
					// This item needs to be updated
					indicesMap.set(`${parentIndex}-${itemIndex}`, {
						parentIndex,
						itemIndex,
						output: item.output
					});
				}
			});
		});

		// If there are no items to update, return with an error message
		if (indicesMap.size === 0) {
			errorMessage = 'Please enter output data for at least one row where the input is also empty.';
			return;
		}

		// Process each item that needs to be updated
		await Promise.all(
			Array.from(indicesMap.values()).map(async ({ parentIndex, itemIndex, output }) => {
				const responseStream = await fetch('/api', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ systemMessage, userMessage, output })
				});

				if (responseStream.ok) {
					const reader = responseStream.body?.getReader();
					if (!reader) return;
					let text = '';
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						text += new TextDecoder().decode(value);
					}

					// Update the input for the fineTuneItem's item
					fineTuneItems[parentIndex].pairs[itemIndex].input = text;
				} else {
					// Handle errors, such as by logging them or setting an error message
					console.error(`Error fetching data for fineTuneItem ${parentIndex}, item ${itemIndex}`);
				}
			})
		);
	}

	type Pair = {
		input: string;
		output: string;
		hovered?: boolean;
	};

	type FineTuneItem = {
		systemMessage: string;
		pairs: Pair[];
	};

	let fineTuneItems: FineTuneItem[] = [];

	function addRow() {
		fineTuneItems = fineTuneItems.concat({
			systemMessage: fineTuneSystemMessage,
			pairs: [
				{
					input: '',
					output: '',
					hovered: false
				}
			]
		});
	}
	// create an onMount function here that adds the first item to the fineTuneItems array
	onMount(() => {
		addRow();
	});

	$: {
		fineTuneItems = fineTuneItems.map((item) => ({
			...item,
			systemMessage: fineTuneSystemMessage
		}));
	}

	function addFineTunePair(index: number) {
		fineTuneItems[index].pairs.push({
			input: '',
			output: ''
		});
		fineTuneItems = fineTuneItems.slice(); // Trigger reactivity
	}
	function updateHoverState(index: number, pairIndex: number, state: boolean) {
		fineTuneItems[index].pairs[pairIndex].hovered = state;
		fineTuneItems = [...fineTuneItems];
	}
	function handleSecondaryClick() {
		let link = document.createElement('a');
		link.href = 'src/lib/assets/examplefiles/example-input-output.csv';
		link.download = 'example-input-output.csv';
		link.click();
	}

	function downloadJSONNLFile() {
		// Define the type for the structure of the transformed items
		type Message = {
			role: 'system' | 'user' | 'assistant';
			content: string;
		};

		type MessagesItem = {
			messages: Message[];
		};

		const transformItems: MessagesItem[] = fineTuneItems.reduce<MessagesItem[]>((acc, item) => {
			const validPairs = item.pairs.filter((pair) => pair.input && pair.output);

			if (validPairs.length > 0) {
				const messages: Message[] = [
					{ role: 'system', content: item.systemMessage || 'No system message' }
				];

				validPairs.forEach((pair) => {
					messages.push({ role: 'user', content: pair.input });
					messages.push({ role: 'assistant', content: pair.output });
				});

				acc.push({ messages });
			}

			return acc;
		}, []);

		const downloadContent = transformItems.map((item) => JSON.stringify(item)).join('\n');

		const blob = new Blob([downloadContent], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'finetune.jsonl';
		link.click();
	}
</script>

<div class="hidden h-full flex-col md:flex w-full items-center">
	<div
		class="container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16 max-w-7xl"
	>
		<h2 class="text-lg font-semibold">FineTuner</h2>
		<div class="flex flex-row gap-x-4">
			<Button on:click={downloadJSONNLFile}>Download File</Button>
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
					A single finetune row can have multiple input and output data points. The system message
					will be the same for all of them.
				</p>
			</div>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="border border-gray-300 rounded-tl-lg">System Message</Table.Head>
						<Table.Head class="border border-gray-300">Input</Table.Head>
						<Table.Head class="border border-gray-300 rounded-tr-lg">Output</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each fineTuneItems as fineTuneItem, index}
						{#each fineTuneItem.pairs as item, i (item)}
							<Table.Row
								class="relative overflow-visible"
								style="  -webkit-transform: translate3d(0, 0, 0);"
								on:mouseenter={() => updateHoverState(index, i, true)}
								on:mouseleave={() => updateHoverState(index, i, false)}
							>
								{#if i === 0}
									<!-- Only render the System Message cell for the first item -->
									<Table.Cell
										class="border border-gray-300 p-2"
										rowspan={fineTuneItem.pairs.length}
									>
										<p>{fineTuneItem.systemMessage}</p>
									</Table.Cell>
								{/if}

								<Table.Cell class="border border-gray-300 p-2">
									<Textarea
										bind:value={item.input}
										placeholder="Your input data here..."
										class="border-none resize-none"
									/>
								</Table.Cell>
								<Table.Cell class="border border-gray-300 p-2">
									<Textarea
										bind:value={item.output}
										placeholder="Your output data here..."
										class="border-none resize-none"
									/>
								</Table.Cell>
								{#if item.hovered}
									<div
										class="w-full justify-center flex items-center absolute top-24 left-24 z-50 overflow-visible"
									>
										<button
											on:click={() => addFineTunePair(index)}
											class="p-2 bg-blue-500 text-white rounded absolute overflow-visible"
										>
											+
										</button>
									</div>
								{/if}
							</Table.Row>
						{/each}
					{/each}
				</Table.Body>
			</Table.Root>

			<div class="flex flex-row w-full justify-between">
				<!-- <Button on:click={consoleLog} variant="secondary">log items to console</Button> -->
				<Button on:click={addRow}>Add Full Row</Button>
			</div>

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
				{#if errorMessage}
					<p class="text-red-500 text-xs font-light">{errorMessage}</p>
				{/if}
				<div class="flex flex-row justify-between">
					<Button variant="link" on:click={handleSecondaryClick}>Download Example File</Button>
					<Button variant="secondary" on:click={triggerFileInput}>Upload CSV</Button>
					<input
						bind:this={fileInput}
						id="file-input-element"
						type="file"
						on:change={handleFileUpload}
						accept=".csv"
						class="hidden"
					/>
				</div>
			</div>
		</div>
	</div>
</div>
