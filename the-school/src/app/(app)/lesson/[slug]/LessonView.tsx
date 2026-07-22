/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch (Rule 0). The interactive "mark complete / ship"
 * controls are passed in as children so this stays pure presentation.
 */
export function LessonView({
  campusName,
  title,
  videoUrl,
  body,
  assignmentDescription,
  children,
}: {
  campusName: string;
  title: string;
  videoUrl: string | null;
  body: string | null;
  assignmentDescription: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest opacity-60">{campusName}</p>
      <h1 className="mt-1 text-3xl font-semibold">{title}</h1>

      {videoUrl && (
        <div className="mt-6 aspect-video overflow-hidden rounded-lg bg-black">
          <iframe src={videoUrl} className="h-full w-full" allowFullScreen />
        </div>
      )}

      {body && <article className="prose mt-8 max-w-none whitespace-pre-wrap">{body}</article>}

      {assignmentDescription && (
        <div className="mt-10 rounded-lg border-2 border-black p-5">
          <h2 className="font-medium">Ship it</h2>
          <p className="mt-1 text-sm opacity-80">{assignmentDescription}</p>
        </div>
      )}

      {children}
    </main>
  );
}
