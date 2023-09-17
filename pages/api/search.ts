import { supabaseAdmin } from "@/utils";
import * as process from "process";

export const config = {
  runtime: "edge",
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const { query, apiKey, matches } = (await req.json()) as {
      query: string;
      apiKey: string;
      matches: number;
    };

    const input = query.replace(/\n/g, " ");
    const apiKe = process.env.OPENAI_API_KEY!;

    // const completion_res = await fetch("https://api.openai.com/v1/chat/completions", {
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${apiKe}`
    //   },
    //   method: "POST",
    //   body: JSON.stringify({
    //     model: "gpt-4",
    //     messages: [
    //       {
    //         role: "system",
    //         content: "You are Rob Walling from the Startups For the Rest of Us podcast answering questions."
    //       },
    //       {
    //         role: "user",
    //         content: `Response to the below in one sentence as if you were Rob Walling on the Startups For the Rest of Us podcast. Do not repeat the question or refer to the question directly. Your job is to mimic a podcast transcript in which this question would be answered naturally.\n\n${input}`
    //       }
    //     ],
    //     max_tokens: 100,
    //     temperature: 0.25,
    //     stream: false
    //   })
    // });

    // let completion_json = await completion_res.json();
    // let completion = completion_json.choices[0].message.content;
    // completion = completion.replace(/\n/g, " ");

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKe}`,
      },
      method: "POST",
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: input,
      }),
    });

    const json = await res.json();
    const embedding = json.data[0].embedding;

    const { data: chunks, error } = await supabaseAdmin.rpc("podcast_search", {
      query_embedding: embedding,
      similarity_threshold: 0.01,
      match_count: matches,
    });

    if (error) {
      console.error(error);
      return new Response("Error", { status: 500 });
    }

    // Extract IDs and podcast_titles from the main matching chunks
    const idTitlePairs = chunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.podcast_title,
    }));

    // Create lists of IDs and titles for the preceding and succeeding chunks
    const prevPairs = idTitlePairs.map((pair) => ({
      id: pair.id - 1,
      title: pair.title,
    }));
    const nextPairs = idTitlePairs.map((pair) => ({
      id: pair.id + 1,
      title: pair.title,
    }));

    // Second Query to get the preceding chunks
    const { data: prevChunks, error: prevError } = await supabaseAdmin
      .from("pg")
      .select("*")
      .in(
        "id",
        prevPairs.map((pair) => pair.id)
      );

    if (prevError) {
      console.error(prevError);
      return new Response("Error", { status: 500 });
    }

    // Third Query to get the succeeding chunks
    const { data: nextChunks, error: nextError } = await supabaseAdmin
      .from("pg")
      .select("*")
      .in(
        "id",
        nextPairs.map((pair) => pair.id)
      );

    if (nextError) {
      console.error(nextError);
      return new Response("Error", { status: 500 });
    }

    // Filter out preceding and succeeding chunks that don't share the same podcast_title
    const filteredPrevChunks = prevChunks.filter((chunk) =>
      prevPairs.some(
        (pair) => pair.id === chunk.id && pair.title === chunk.podcast_title
      )
    );
    const filteredNextChunks = nextChunks.filter((chunk) =>
      nextPairs.some(
        (pair) => pair.id === chunk.id && pair.title === chunk.podcast_title
      )
    );

    // Combine all chunks
    const allChunks = [...filteredPrevChunks, ...chunks, ...filteredNextChunks];

    return new Response(JSON.stringify(allChunks), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
