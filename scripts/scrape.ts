import { AxiosResponse } from "axios";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import csv from "csv-parser"; // Add a CSV parser for reading the list of URLs
import { encode } from "gpt-3-encoder";

// Define new TypeScript types for Podcast
interface PodcastChunk {
  podcast_title: string;
  podcast_url: string;
  podcast_date: string;
  content: string;
  content_length: number;
  content_tokens: number;
  embedding: any[];
}

interface Podcast {
  title: string;
  url: string;
  date: string;
  content: string;
  length: number;
  tokens: number;
  chunks: PodcastChunk[];
}

interface PodcastJSON {
  current_date: string;
  author: string;
  url: string;
  length: number;
  tokens: number;
  podcasts: Podcast[];
}

const CHUNK_SIZE = 200;

const readCSV = async (filePath: string): Promise<{ url: string }[]> => {
  // get the list of URLs from the CSV file "podcast_links.csv"
  let urls = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => urls.push(data))
      .on("end", () => {
        resolve(urls);
      })
      .on("error", (error) => reject(error));
  });
};

const getPodcast = async (linkObj: { url: string }): Promise<Podcast> => {
  const { url } = linkObj;

  if (!url) {
    throw new Error("URL is undefined"); // Throw an error if URL is undefined
  }

  const html: AxiosResponse = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537",
    },
  });

  if (!html) return null;

  const $ = cheerio.load(html.data);

  const title = $(".entry-title").text() || "";
  const date = $("time.entry-time").text() || "";
  let content = $("div.ssp-transcript-content").text();

  if (!content) {
    const entryContentFirst = $(".entry-content-first");
    content = "";

    // Step 3: Find the <p> that contains "Transcript" within the selected <div>
    entryContentFirst.find("p").each(function (index, element) {
      if ($(this).text().includes("Transcript")) {
        // Step 4: Once the <p> with "Transcript" is found, start iterating through all following siblings until a <div> is hit
        let current = $(this);
        while (current.length > 0 && current[0].tagName !== "div") {
          content += current.text() + "\n";
          current = current.next();
        }
        return false; // Exit the loop once we've found and processed the "Transcript" section
      }
    });
  }

  let cleanedContent = content.replace(/\s+/g, " ").trim();
  cleanedContent = content.replace(/\[[^\]]*\]/g, "");

  return {
    title,
    url,
    date,
    content: cleanedContent,
    length: cleanedContent.length,
    tokens: encode(cleanedContent).length,
    chunks: [],
  };
};

const chunkPodcast = async (podcast: Podcast): Promise<Podcast> => {
  const { title, url, date, content } = podcast;

  let essayTextChunks = [];

  if (encode(content).length > CHUNK_SIZE) {
    const split = content.split(". ");
    let chunkText = "";

    for (let i = 0; i < split.length; i++) {
      const sentence = split[i];
      const sentenceTokenLength = encode(sentence);
      const chunkTextTokenLength = encode(chunkText).length;

      if (chunkTextTokenLength + sentenceTokenLength.length > CHUNK_SIZE) {
        essayTextChunks.push(chunkText);
        chunkText = "";
      }

      if (sentence && sentence.length > 0) {
        if (sentence[sentence.length - 1].match(/[a-z0-9]/i)) {
          chunkText += sentence + ". ";
        } else {
          chunkText += sentence + " ";
        }
      }
    }

    essayTextChunks.push(chunkText.trim());
  } else {
    essayTextChunks.push(content.trim());
  }

  const essayChunks = essayTextChunks.map((text) => {
    const trimmedText = text.trim();

    const chunk: PodcastChunk = {
      podcast_title: title,
      podcast_url: url,
      podcast_date: date,
      content: trimmedText,
      content_length: trimmedText.length,
      content_tokens: encode(trimmedText).length,
      embedding: [],
    };

    return chunk;
  });

  if (essayChunks.length > 1) {
    for (let i = 0; i < essayChunks.length; i++) {
      const chunk = essayChunks[i];
      const prevChunk = essayChunks[i - 1];

      if (chunk.content_tokens < 100 && prevChunk) {
        prevChunk.content += " " + chunk.content;
        prevChunk.content_length += chunk.content_length;
        prevChunk.content_tokens += chunk.content_tokens;
        essayChunks.splice(i, 1);
        i--;
      }
    }
  }

  const chunkedSection: Podcast = {
    ...podcast,
    chunks: essayChunks,
  };

  return chunkedSection;
};

(async () => {
  const filePath = "podcast_links.csv";
  const links = await readCSV(filePath);

  console.log(`Found ${links.length} links`);

  let podcasts: Podcast[] = [];

  try {
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log(`Getting podcast for ${link.url}`);
      const podcast = await getPodcast(link);
      const chunkedPodcast = await chunkPodcast(podcast);
      podcasts.push(chunkedPodcast);
    }
  } catch (error) {
    console.error("An error occurred:", error);

    const json: PodcastJSON = {
      current_date: "2023-09-11", // You should probably use a dynamic date here
      author: "Rob Walling",
      url: "https://www.startupsfortherestofus.com/",
      length: podcasts.reduce((acc, podcast) => acc + podcast.length, 0),
      tokens: podcasts.reduce((acc, podcast) => acc + podcast.tokens, 0),
      podcasts,
    };

    fs.writeFileSync("podcasts_error.json", JSON.stringify(json));
    process.exit(1); // Exit with an error code
  }

  const json: PodcastJSON = {
    current_date: "2023-09-11",
    author: "Rob Walling",
    url: "https://www.startupsfortherestofus.com/",
    length: podcasts.reduce((acc, podcast) => acc + podcast.length, 0),
    tokens: podcasts.reduce((acc, podcast) => acc + podcast.tokens, 0),
    podcasts,
  };

  fs.writeFileSync("podcasts.json", JSON.stringify(json));
})();
