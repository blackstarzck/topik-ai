import { Editor } from '@tinymce/tinymce-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Editor as TinyMceEditor } from 'tinymce';

export const DEFAULT_TINYMCE_PLUGINS = [
  'advlist',
  'anchor',
  'autolink',
  'charmap',
  'code',
  'fullscreen',
  'help',
  'image',
  'insertdatetime',
  'link',
  'lists',
  'media',
  'preview',
  'searchreplace',
  'table',
  'visualblocks'
] as const;

export const DEFAULT_TINYMCE_TOOLBAR =
  'undo redo | styles | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image';

type TinyMceHtmlEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  editorId?: string;
  height?: number | string;
  className?: string;
  plugins?: readonly string[];
  toolbar?: string;
  setup?: (editor: TinyMceEditor) => void;
};

export function TinyMceHtmlEditor({
  value,
  onChange,
  editorId = 'default-editor',
  height,
  className = 'content-html-editor',
  plugins = DEFAULT_TINYMCE_PLUGINS,
  toolbar = DEFAULT_TINYMCE_TOOLBAR,
  setup
}: TinyMceHtmlEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolvedHeight, setResolvedHeight] = useState<number | undefined>(
    typeof height === 'number' ? height : undefined
  );

  useLayoutEffect(() => {
    if (typeof height === 'number') {
      setResolvedHeight(height);
      return;
    }

    const container = containerRef.current;
    const sizingElement = container?.parentElement;

    if (!container || !sizingElement) {
      return;
    }

    let frameId: number | null = null;

    const updateHeight = () => {
      frameId = null;

      const nextHeight = Math.max(sizingElement.clientHeight, 320);

      setResolvedHeight((prevHeight) =>
        prevHeight === nextHeight ? prevHeight : nextHeight
      );
    };

    const scheduleUpdate = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(updateHeight);
    };

    scheduleUpdate();

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });

    resizeObserver.observe(sizingElement);

    return () => {
      resizeObserver.disconnect();

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: typeof height === 'string' ? height : undefined
      }}
    >
      <Editor
        key={`${editorId}-${resolvedHeight ?? 'auto'}`}
        id={editorId}
        licenseKey="gpl"
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        value={value ?? ''}
        init={{
          plugins: [...plugins],
          toolbar,
          height: resolvedHeight,
          width: '100%',
          borderColor: 'transparent',
          resize: false,
          setup
        }}
        onEditorChange={(nextValue) => onChange?.(nextValue)}
      />
    </div>
  );
}
