import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { Configuration, OpenAIApi } from "openai";

loadEnvConfig("");

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

const generateEmbeddings = async (podcasts: Podcast[]) => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (let i = 0; i < podcasts.length; i++) {
    const section = podcasts[i];


    for (let j = 0; j < section.chunks.length; j++) {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const chunk = section.chunks[j];
      const {
        podcast_title,
        podcast_url,
        podcast_date,
        content,
        content_length,
        content_tokens,
      } = chunk;

      let embeddingResponse;

      try {
        embeddingResponse = await openai.createEmbedding({
          model: "text-embedding-ada-002",
          input: content,
        });
      } catch (e) {
        embeddingResponse = await openai.createEmbedding({
          model: "text-embedding-ada-002",
          input: content,
        });
      }
      const [{ embedding }] = embeddingResponse.data.data;
      const { data, error } = await supabase
        .from("pg")
        .insert({
          podcast_title: podcast_title,
          podcast_url: podcast_url,
          podcast_date: podcast_date,
          content,
          content_length,
          content_tokens,
          embedding,
        })
        .select("*");

      if (error) {
        console.log("error", error);
      } else {
        console.log("saved", i, j);
      }
    }
  }
};

(async () => {
  const book: PodcastJSON = JSON.parse(
    fs.readFileSync("podcasts.json", "utf8")
  );

  await generateEmbeddings(book.podcasts);
})();
