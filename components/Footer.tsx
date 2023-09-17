import { IconBrandGithub, IconBrandTwitter } from "@tabler/icons-react";
import { FC } from "react";

export const Footer: FC = () => {
  return (
    <div className="flex h-[50px] border-t border-gray-300 py-2 px-8 items-center justify-center">
      <div className="hidden sm:flex"></div>

      <div className="hidden sm:flex italic text-sm center">
        Created by
        <a
          className="hover:opacity-50 mx-1"
          href="https://twitter.com/The_Matt_Brooks"
          target="_blank"
          rel="noreferrer"
        >
          <b>Matt Brooks</b>
        </a>, based on the the Startups For the Rest of Us podcast transcripts
        <a
          className="hover:opacity-50 ml-1"
          href="https://twitter.com/robwalling"
          target="_blank"
          rel="noreferrer"
        >
          Rob Walling
        </a>
        .
      </div>

    </div>
  );
};
