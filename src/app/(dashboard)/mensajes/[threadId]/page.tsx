export default function ThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Conversación</h1>
      <p className="text-sm text-gray-500">Thread: {params.threadId}</p>
      {/* TODO: render communications list + reply composer */}
    </div>
  );
}
