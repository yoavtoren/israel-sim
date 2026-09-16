/** Time-series panel chart. One y-axis per chart; two measures of different
 *  scale get two charts (small multiples), never a dual axis.
 */

import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from "recharts";
import { INK } from "../lib/colors";

/** Shaded historical episode (e.g. second intifada, COVID) behind the series. */
export interface Episode {
  from: string;
  to: string;
  label: string;
}

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
    <div className="overlay min-w-[150px] rounded-[10px] border border-line0 bg-bg1 px-3 py-2 text-[12px] leading-[18px]">
      <div className="num mb-1 text-[11.5px] font-medium text-fg2">{String(props.label)}</div>
      {props.payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 py-px">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: String(p.color) }} />
          <span className="text-fg1">{p.name}</span>
          <span className="num ms-auto ps-3 font-medium text-fg0">{props.format(Number(p.value))}</span>
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
  episodes?: Episode[];
  /** join lines across missing values (sparse historical anchors) */
  connectNulls?: boolean;
}) {
  return (
    <bdi dir="ltr" className="block">
      <div style={{ height: props.height ?? 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
            <CartesianGrid stroke={INK.line0} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "Rubik, system-ui, sans-serif" }}
              axisLine={{ stroke: INK.line1 }}
              tickMargin={6}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "Rubik, system-ui, sans-serif" }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) => props.format(v)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={(p: TooltipProps<number, string>) => <ChartTooltip {...p} format={props.format} />}
              cursor={{ stroke: INK.line1, strokeDasharray: "3 3" }}
            />
            {props.episodes?.map((ep) => (
              <ReferenceArea
                key={ep.label}
                x1={ep.from}
                x2={ep.to}
                fill="#EFE9DE"
                fillOpacity={0.7}
                stroke="none"
                label={{ value: ep.label, position: "insideTop", fill: INK.fg2, fontSize: 10.5, fontFamily: "Rubik, system-ui, sans-serif" }}
              />
            ))}
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
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: "#FFFFFF" }}
                strokeLinecap="round"
                connectNulls={props.connectNulls === true}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {props.series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1" dir="auto">
          {props.series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[12px] leading-[18px] text-fg1">
              <span
                className="inline-block h-0 w-4 rounded-full"
                style={{ borderTop: `2.5px ${s.dash === true ? "dotted" : "solid"} ${s.color}` }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </bdi>
  );
}
