import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PodcastChunk } from "@/types";
import { IconExternalLink, IconSearch, IconSend } from "@tabler/icons-react";
import endent from "endent"; // To create multilines strings with consistent indentation
import Head from "next/head"; // To manage the 'head' of the React document
import { KeyboardEvent, useEffect, useRef, useState } from "react"; // Import React hooks

// Define the Home component
export default function Home() {
  // Initialize state variables using the useState hook
  const inputRef = useRef<HTMLInputElement>(null); // Reference to the input field

  // Define state for handling user input, search results, answer and loading status
  let [query, setQuery] = useState<string>("");
  const [chunks, setChunks] = useState<PodcastChunk[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [answerCompleted, setAnswerCompleted] = useState<boolean>(false);

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [mode, setMode] = useState<"search" | "chat">("chat");
  const [matchCount, setMatchCount] = useState<number>(10);
  const [apiKey, setApiKey] = useState<string>("");


  /*
    Define function to handle searching, which fetches search results from the API
    check for API key and query
    clear previous results
    set loading state to true, to show loading indicator
    fetch search results from the API
    if the response is not ok, throw an error
    set the search results in the state
    set loading state to false, to hide loading indicator
 */
  const handleSearch = async () => {
    if (!apiKey) {
      alert("Please enter an API key.");
      return;
    }

    if (!query) {
      alert("Please enter a query.");
      return;
    }

    setAnswer("");
    setChunks([]);

    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, apiKey, matches: matchCount }),
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    const results: PodcastChunk[] = await searchResponse.json();

    // remove chunks that have the same podcast title
    const filteredResults = results.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.podcast_title === item.podcast_title)
    );

    setChunks(results);

    setLoading(false);

    inputRef.current?.focus();

    return results;
  };

  // Define function to handle generating an answer, which fetches an answer from the API
  // Similar to handleSearch, but also fetches an answer based on the search results
  const handleAnswer = async (button_query?: string) => {
    // Error handling: check for API key and query

    query = button_query || query;

    if (!query) {
      alert("Please enter a query.");
      return;
    }

    setAnswer("");
    setChunks([]);

    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, apiKey, matches: matchCount }),
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    let results: PodcastChunk[] = await searchResponse.json();

    // Sort the results array by podcast_date in descending order
    results.sort(
      (a, b) =>
        new Date(b.podcast_date).getTime() - new Date(a.podcast_date).getTime()
    );

    // Remove duplicates based on podcast_title
    const seenTitles = new Map();
    const uniqueResults = results.filter((chunk) => {
      const title = chunk.podcast_title;
      if (seenTitles.has(title)) {
        return false;
      }
      seenTitles.set(title, true);
      return true;
    });

    setChunks(uniqueResults);

    const prompt = endent`
    Your task is to answer the following question as concisely, readably, and simply as you can while being absolutely factual and correct. Your audience are smart and driven SAAS bootstrappers:
    Question: "${query}"

    Use the information below from Rob Walling's podcast 'The Startups For the Rest of Us' to answer the above query. Ignore any text that is not relevant to the question. Be accurate, helpful, concise, and clear but most importantly readable. Lead in with an overall concise answer and then below that only provide the most important context, information, or clarifying content. Reply in proper HTML with line breaks and bolded text to make the text easier to read. Please try your best as this is a very important question. Thank you!!
    
    ----

    ${results?.map((d: any) => d.content).join("\n\n")}
    `;

    let type = "answer";

    const answerResponse = await fetch("/api/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, apiKey, type }),
    });

    if (!answerResponse.ok) {
      setLoading(false);
      throw new Error(answerResponse.statusText);
    }

    const data = answerResponse.body;

    if (!data) {
      return;
    }

    setLoading(false);

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setAnswer((prev) => prev + chunkValue);
      if (doneReading) {
        setAnswerCompleted(true);
      }
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (mode === "search") {
        handleSearch();
      } else {
        handleAnswer();
      }
    }
  };

  const handleSave = () => {
    if (apiKey.length !== 51) {
      alert("Please enter a valid API key.");
      return;
    }

    localStorage.setItem("PG_KEY", apiKey);
    localStorage.setItem("PG_MATCH_COUNT", matchCount.toString());
    localStorage.setItem("PG_MODE", mode);

    setShowSettings(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    localStorage.removeItem("PG_KEY");
    localStorage.removeItem("PG_MATCH_COUNT");
    localStorage.removeItem("PG_MODE");

    setApiKey("");
    setMatchCount(5);
    setMode("search");
  };

  useEffect(() => {
    if (matchCount > 10) {
      setMatchCount(10);
    } else if (matchCount < 1) {
      setMatchCount(1);
    }
  }, [matchCount]);

  useEffect(() => {
    const PG_KEY = localStorage.getItem("PG_KEY");
    const PG_MATCH_COUNT = localStorage.getItem("PG_MATCH_COUNT");
    const PG_MODE = localStorage.getItem("PG_MODE");

    if (PG_KEY) {
      setApiKey(PG_KEY);
    }

    if (PG_MATCH_COUNT) {
      setMatchCount(parseInt(PG_MATCH_COUNT));
    }

    if (PG_MODE) {
      setMode(PG_MODE as "search" | "chat");
    }

    inputRef.current?.focus();
  }, []);

  return (
    <>
      <Head>
        <title>Startups For the Rest of Us Chatbot</title>
        <meta
          name="description"
          content={`AI-powered chat for the Startups For the Rest of Us podcast.`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col h-screen">
        <Navbar />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex h-full w-full max-w-[750px] flex-col items-center px-3 pt-4 sm:pt-8">
            {/* <button
              className="mt-4 flex cursor-pointer items-center space-x-2 rounded-full border border-zinc-600 px-3 py-1 text-sm hover:opacity-50"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? "Hide" : "Show"} Settings
            </button> */}

            {showSettings && (
              <div className="w-[340px] sm:w-[400px]">
                <div>
                  <div>Mode</div>
                  <select
                    className="max-w-[400px] block w-full cursor-pointer rounded-md border border-gray-300 p-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value as "search" | "chat")
                    }
                  >
                    <option value="search">Search</option>
                    <option value="chat">Chat</option>
                  </select>
                </div>

                <div className="mt-2">
                  <div>Results Count</div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={matchCount}
                    onChange={(e) => setMatchCount(Number(e.target.value))}
                    className="max-w-[400px] block w-full rounded-md border border-gray-300 p-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div className="mt-2">
                  <div>OpenAI API Key</div>
                  <input
                    type="password"
                    placeholder="OpenAI API Key"
                    className="max-w-[400px] block w-full rounded-md border border-gray-300 p-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);

                      if (e.target.value.length !== 51) {
                        setShowSettings(true);
                      }
                    }}
                  />
                </div>

                <div className="mt-4 flex space-x-2 justify-center">
                  <div
                    className="flex cursor-pointer items-center space-x-2 rounded-full bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
                    onClick={handleSave}
                  >
                    Save
                  </div>

                  <div
                    className="flex cursor-pointer items-center space-x-2 rounded-full bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                    onClick={handleClear}
                  >
                    Clear
                  </div>
                </div>
              </div>
            )}

          
              <div className="relative w-full mt-4">
                <IconSearch className="absolute top-3 w-10 left-1 h-6 rounded-full opacity-50 sm:left-3 sm:top-4 sm:h-8" />

                <input
                  ref={inputRef}
                  className="h-12 w-full rounded-lg border border-zinc-600 pr-12 pl-11 focus:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-800 sm:h-16 sm:py-2 sm:pr-16 sm:pl-16 sm:text-lg"
                  type="text"
                  placeholder="Why is recurring revenue important?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <button className="flex items-center justify-center absolute rotate-45	rounded-full w-10 h-10 hover:cursor-pointer sm:right-3 sm:top-3">
                  <IconSend
                    onClick={(event) => {
                      event.preventDefault();
                      mode === "search" ? handleSearch() : handleAnswer();
                    }}
                  />
                </button>
              </div>
           

            {loading ? (
              <div className="mt-6 w-full">
                {mode === "chat" && (
                  <>
                    <div className="animate-pulse mt-2">
                      <div className="h-4 bg-gray-300 rounded"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                    </div>
                  </>
                )}
              </div>
            ) : answer ? (
              <div className="mt-8 max-w-xlg">
                <div className="p-6">
                  <div dangerouslySetInnerHTML={{ __html: answer }} />
                </div>
                {answerCompleted && (
                  <div className="mt-8 mb-16 border rounded-lg p-6">
                    <div className="font-bold text-lg">Relevant Episodes</div>

                    {chunks.map((chunk, index) => (
                      <div key={index}>
                        <div className="rounded-lg">
                          <div>
                            <a
                              className="hover:opacity-50 ml-2"
                              href={chunk.podcast_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <div className="text-sm flex space-between w-full">
                                <div className="mr-4">
                                  {chunk.podcast_title}
                                </div>
                                <div className="ml-auto min-w-[100px]">
                                  {new Date(chunk.podcast_date).toLocaleString(
                                    "en-US",
                                    { month: "short", year: "numeric" }
                                  )}
                                </div>
                              </div>
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : chunks.length > 0 && answerCompleted ? (
              <div className="mt-6 pb-16">
                <div className="font-bold text-lg">Relevant Episodes</div>
                {chunks.map((chunk, index) => (
                  <div key={index}>
                    <div className="mt-4rounded-lg p-4">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-bold text-xl">
                            {chunk.podcast_title}
                          </div>
                          <div className="mt-1 font-bold text-sm">
                            {chunk.podcast_date}
                          </div>
                        </div>
                        <a
                          className="hover:opacity-50 ml-2"
                          href={chunk.podcast_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="cursor-pointer">
                            <IconExternalLink />
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-6 text-center text-lg">{`AI chat for the Startups For the Rest of Us Podcast. Try a common question:`}</div>
                <div className="mt-4">
                  <div className="flex space-x-2 text-center">
                    <div
                      className="flex cursor-pointer items-center space-x-2 rounded-lg px-3 py-1 text-sm border border-zinc-600 center hover:bg-zinc-600 hover:text-white"
                      onClick={() => {
                        setQuery("What is a microconf?");
                        handleAnswer("What is a microconf?");
                      }}
                    >
                      What is a microconf?
                    </div>

                    <div
                      className="flex cursor-pointer items-center space-x-2 rounded-lg px-3 py-1 text-sm border border-zinc-600 center hover:bg-zinc-600 hover:text-white"
                      onClick={() => {
                        setQuery("Why is VC funding not always a good idea?");
                        handleAnswer(
                          "Why is VC funding not always a good idea?"
                        );
                      }}
                    >
                      Why is VC funding not always a good idea?
                    </div>
                    <div
                      className="flex cursor-pointer  items-center space-x-2 rounded-lg  px-3 py-1 text-sm border border-zinc-600 center hover:bg-zinc-600 hover:text-white"
                      onClick={() => {
                        setQuery("How do you find product market fit?");
                        handleAnswer("How do you find product market fit?");
                      }}
                    >
                      How do you find product market fit?
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
