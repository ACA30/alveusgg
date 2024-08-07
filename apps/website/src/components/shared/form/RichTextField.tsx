import { useEffect, useRef, useState } from "react";
import { type AriaTextFieldOptions, useTextField } from "react-aria";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import "quill-emoji/dist/quill-emoji.css";
import { Quill } from "react-quill";
import type { default as ReactQuillType } from "react-quill";
import { z } from "zod";

const ReactQuill = dynamic<
  ReactQuillType.ReactQuillProps & {
    forwardedRef?: React.LegacyRef<ReactQuillType>;
  }
>(
  async () => {
    const { default: RQ } = await import("react-quill");
    return function DynamicReactQuill({ forwardedRef, ...props }) {
      return <RQ ref={forwardedRef} {...props} />;
    };
  },
  {
    ssr: false,
  },
);

// Register quill-emoji module
import Emoji from "quill-emoji";
import { classes } from "@/utils/classes";
Quill.register("modules/emoji", Emoji);

const EmoteFileSchema = z.object({
  name: z.string(),
  static_name: z.string(),
  width: z.number(),
  height: z.number(),
  frame_count: z.number(),
  size: z.number(),
  format: z.string(),
});

const EmoteHostSchema = z.object({
  url: z.string(),
  files: z.array(EmoteFileSchema),
});

const EmoteDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  flags: z.number(),
  lifecycle: z.number(),
  state: z.array(z.string()),
  listed: z.boolean(),
  animated: z.boolean(),
  owner: z.object({
    id: z.string(),
    username: z.string(),
    display_name: z.string(),
    avatar_url: z.string(),
    style: z.any(),
    roles: z.array(z.string()),
  }),
  host: EmoteHostSchema,
});

const EmoteSchema = z.object({
  id: z.string(),
  name: z.string(),
  flags: z.number(),
  timestamp: z.number(),
  actor_id: z.string().nullable(),
  data: EmoteDataSchema,
});

const EmoteSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  flags: z.number(),
  tags: z.array(z.string()),
  immutable: z.boolean(),
  privileged: z.boolean(),
  emotes: z.array(EmoteSchema),
});

type Emote = z.infer<typeof EmoteSchema>;

const fetch7TVEmotes = async (setId: string): Promise<Emote[]> => {
  try {
    const response = await fetch(`https://7tv.io/v3/emote-sets/${setId}`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    const parsedData = EmoteSetSchema.parse(data);
    return parsedData.emotes;
  } catch (error) {
    console.error("Error fetching 7TV emotes:", error);
    return [];
  }
};

type FormFieldProps = AriaTextFieldOptions<"input"> & {
  label: string;
  className?: string;
};

const nf = new Intl.NumberFormat(undefined);

export function RichTextField({ defaultValue, ...props }: FormFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReactQuillType | null>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const { labelProps, inputProps } = useTextField(props, ref);
  const [value, setValue] = useState(defaultValue || "");
  const [emotes, setEmotes] = useState<Emote[]>([]);

  useEffect(() => {
    const loadEmotes = async () => {
      const fetchedEmotes = await fetch7TVEmotes("61ec9b29cc9507d24fd4bfad"); // fetch TTV/AlveusSanctuary emotes
      setEmotes(fetchedEmotes);
    };

    loadEmotes();
  }, []);

  const customEmojiList = emotes.map((emote) => ({
    name: emote.name,
    shortname: `:${emote.name}:`,
    text: "",
    type: "image",
    unicode: emote.data.host.files.find((file) => file.format === "WEBP")
      ?.static_name,
    url:
      emote.data.host.url +
      "/" +
      emote.data.host.files.find((file) => file.format === "WEBP")?.name,
  }));

  const quillConfig: Partial<ReactQuillType.ReactQuillProps> = {
    theme: "snow",
    modules: {
      toolbar: [
        ["bold", "italic", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["emoji"], // Add emoji button to the toolbar
        ["clean"],
      ],
      history: true,
      "emoji-toolbar": true,
      "emoji-textarea": false,
      "emoji-shortname": true,
      emoji: {
        imagePath: "", // Required, although not used in this configuration
        customEmojiList, // Pass custom emojis
      },
    },
    formats: ["bold", "italic", "strike", "list", "bullet", "link", "emoji"],
  };

  return (
    <div className={classes("flex-1", props.className)}>
      <div className="flex flex-row items-end justify-between">
        <label
          {...labelProps}
          onClick={() => {
            editorRef.current?.focus();
          }}
        >
          {props.label}
        </label>
        {props.maxLength && (
          <span className="text-sm text-gray-600" ref={counterRef}>
            Characters 0 / {nf.format(props.maxLength)}
          </span>
        )}
      </div>
      <input
        className="sr-only"
        {...inputProps}
        type="hidden"
        name={props.name}
        value={value}
        ref={ref}
      />

      <ReactQuill
        {...quillConfig}
        value={value}
        onChange={(value) => setValue(value)}
        className="alveus-rte bg-white"
        forwardedRef={(ref) => {
          editorRef.current = ref;
          if (ref) {
            const quill = ref.getEditor();

            quill.on("text-change", () => {
              if (props.maxLength) {
                const len = quill.getLength() - 1;
                if (len > props.maxLength) {
                  quill.deleteText(props.maxLength, len);
                }

                if (counterRef.current) {
                  const count = nf.format(Math.max(0, len));
                  const max = nf.format(props.maxLength);
                  counterRef.current.textContent = `Characters ${count} / ${max}`;
                }
              }
            });
          }
        }}
      />
    </div>
  );
}
