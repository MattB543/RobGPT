export enum OpenAIModel {
  DAVINCI_TURBO = "gpt-3.5-turbo"
}

export type PodcastChunk = {
  podcast_title: string;
  podcast_url: string;
  podcast_date: string;
  content: string;
  content_length: number;
  content_tokens: number;
  embedding: any[];
}

export type Podcast = {
  title: string;
  url: string;
  date: string;
  content: string;
  length: number;
  tokens: number;
  chunks: PodcastChunk[];
}

export type PodcastJSON = {
  current_date: string;
  author: string;
  url: string;
  length: number;
  tokens: number;
  podcasts: Podcast[];
}