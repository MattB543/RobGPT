import { OpenAIStream, Followupquestions } from "@/utils";

export const config = {
  runtime: "edge",
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const { prompt, apiKey, type } = (await req.json()) as {
      prompt: string;
      apiKey: string;
      type: string;
    };
    let apiKe = process.env.OPENAI_API_KEY!;

    let stream;

    if (type === "answer") {
      stream = await OpenAIStream(prompt, apiKe);
    }

    return new Response(stream);
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
