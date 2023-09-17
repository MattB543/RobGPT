import { OpenAIStream, Followupquestions } from "@/utils";
import process from "process";

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
    const apiKe = process.env.OPENAI_API_KEY!;

    let stream;

    if (type === "answer") {
      stream = await OpenAIStream(prompt, apiKe);
    } else if (type === "followup") {
      stream = await Followupquestions(prompt, apiKe);
    }

    return new Response(stream);
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
