import { parse } from "dotenv/mod.ts";
import * as mfm from "mfm-js/";

const segmenter = new Intl.Segmenter("jp", { granularity: "word" });

export function tokenize(text: string): string[] {
  return [...segmenter.segment(text)].map((x) => x.segment);
}

export function tokenizeMfm(text: string): string[] {
  const processMfm = (tree: mfm.MfmNode): string[] => {
    switch (tree.type) {
      case "text":
        return tokenize(tree.props.text);

      case "link":
      case "url":
        return [tree.props.url];

      case "hashtag":
        return tokenize(tree.props.hashtag);

      case "unicodeEmoji":
        return [tree.props.emoji];

      case "strike":
      case "small":
      case "quote":
      case "plain":
      case "center":
        return tree.children.flatMap((x) => processMfm(x));

      case "fn":
        return [
          `$[${tree.props.name}${
            tree.props.args
              ? "." +
                Object.entries(tree.props.args).map((x) => x.join("=")).join(
                  ",",
                )
              : ""
          }`,
          ...tree.children.flatMap((x) => processMfm(x)),
          "]",
        ];

      case "search":
        return tokenize(tree.props.content);

      case "mention":
        return [tree.props.acct];

      case "mathInline":
      case "mathBlock":
      case "inlineCode":
      case "blockCode":
        return [];

      case "emojiCode":
        return [":" + tree.props.name + ":"];

      case "bold":
        return ["**", ...tree.children.flatMap((x) => processMfm(x)), "**"];

      case "italic":
        return ["_", ...tree.children.flatMap((x) => processMfm(x)), "_"];

      default:
        return [];
    }
  };

  return mfm.parse(text).flatMap((x) => processMfm(x));
}
