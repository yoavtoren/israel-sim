/** Time-series panel chart. One y-axis per chart; two measures of different
 *  scale get two charts (small multiples), never a dual axis.
 */

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from "recharts";
import { INK } from "../lib/colors";

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
  dash?: boolean;
}

export type ChartRow = Record<string, number | string>;

function ChartTooltip(props: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (props.active !== true || props.payload === undefined || props.payload.length === 0) return null;
  return (
    <div className="overlay rounded-[4px] border border-line1 bg-bg2 px-2 py-1 text-[12px]">
      <div className="num mb-0.5 text-fg2">{String(props.label)}</div>
      {props.payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: String(p.color) }} />
          <span className="text-fg1">{p.name}</span>
          <span className="num ms-auto text-fg0">{props.format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function SeriesChart(props: {
  data: ChartRow[];
  series: SeriesDef[];
  format: (v: number) => string;
  height?: number;
}) {
  return (
    <bdi dir="ltr" className="block">
      <div style={{ height: props.height ?? 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={INK.line0} vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "IBM Plex Mono" }}
              axisLine={{ stroke: INK.line1 }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "IBM Plex Mono" }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v: number) => props.format(v)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={(p: TooltipProps<number, string>) => <ChartTooltip {...p} format={props.format} />}
              cursor={{ stroke: INK.line1 }}
            />
            {props.series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash === true ? "5 4" : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {props.series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3 px-1">
          {props.series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] leading-[16px] text-fg1">
              <span className="inline-block h-2 w-3 rounded-[1px]" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </bdi>
  );
}
