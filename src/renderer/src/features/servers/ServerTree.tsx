import { useEffect } from 'react'
import { useServersStore } from '@renderer/store/servers'

export function ServerTree(): JSX.Element {
  const { servers, loaded, load } = useServersStore()

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  return (
    <div className="p-2 text-sm">
      <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-neutral-500">
        Servers
      </div>
      {servers.length === 0 && (
        <p className="px-2 py-3 text-xs text-neutral-500">
          No servers yet. Click + to add one.
        </p>
      )}
      <ul>
        {servers.map((s) => (
          <li
            key={s.id}
            className="px-2 py-1.5 rounded hover:bg-neutral-800/60 cursor-pointer"
          >
            <div className="font-medium">{s.name}</div>
            <div className="text-[11px] text-neutral-500">
              {s.username}@{s.host}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
