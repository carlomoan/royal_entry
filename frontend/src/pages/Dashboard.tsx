// ==============================================================================
// FILE: src/pages/Dashboard.tsx
// ==============================================================================
// Live arrivals dashboard — refreshes every 10 seconds during active events

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  UserCheck,
  CalendarDays,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { eventsApi } from "@/api/events";
import { scannerApi } from "@/api/scanner";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/utils/format";
import { Link } from "react-router-dom";

export default function Dashboard() {
  // Fetch all events to find active ones
  const { data: eventsData } = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsApi.list(1, 50),
  });

  const events = eventsData?.data ?? [];
  const active = events.filter((e) => e.status === "active");
  const upcoming = events.filter(
    (e) => e.status === "approved" || e.status === "draft",
  );

  // Live stats for the first active event
  const activeEvent = active[0];
  const { data: scanStats, dataUpdatedAt } = useQuery({
    queryKey: ["scan-stats", activeEvent?.id],
    queryFn: () => scannerApi.stats(activeEvent!.id),
    enabled: !!activeEvent,
    refetchInterval: 10_000, // auto-refresh every 10s
  });

  const { data: eventSummary } = useQuery({
    queryKey: ["event-summary", activeEvent?.id],
    queryFn: () => eventsApi.summary(activeEvent!.id),
    enabled: !!activeEvent,
    refetchInterval: 10_000,
  });

  const summary = eventSummary?.summary;
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Active event banner */}
      {activeEvent ? (
        <div className="bg-navy-800 rounded-2xl p-6 text-white border border-gold-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-wide">
                  Live Event
                </span>
              </div>
              <h2 className="text-2xl font-bold">{activeEvent.title}</h2>
              <p className="text-gray-400 text-sm mt-1">
                {activeEvent.venue_name} · {formatDate(activeEvent.event_date)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-black text-gold-400">
                {scanStats?.arrived ?? 0}
              </div>
              <p className="text-gray-400 text-sm">guests arrived</p>
              {lastUpdated && (
                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1 justify-end">
                  <RefreshCw className="w-3 h-3" /> {lastUpdated}
                </p>
              )}
            </div>
          </div>

          {/* Arrival progress bar */}
          {scanStats && scanStats.total_guests > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{scanStats.arrival_rate_percent}% arrived</span>
                <span>
                  {scanStats.arrived} / {scanStats.total_guests}
                </span>
              </div>
              <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-400 rounded-full transition-all duration-700"
                  style={{ width: `${scanStats.arrival_rate_percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">
            No active events right now
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Activate an event to see live arrivals here.
          </p>
          <Link
            to="/events"
            className="inline-block mt-4 px-4 py-2 bg-gold-500 text-navy-900
                       rounded-lg text-sm font-semibold hover:bg-gold-600 transition-colors"
          >
            Go to Events
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Guests"
          value={summary?.total_guests ?? scanStats?.total_guests ?? 0}
          icon={Users}
          subtitle="Invited this event"
          color="blue"
        />
        <StatCard
          title="Checked In"
          value={scanStats?.arrived ?? 0}
          icon={UserCheck}
          subtitle={`${scanStats?.arrival_rate_percent ?? 0}% attendance`}
          color="green"
        />
        <StatCard
          title="RSVP Confirmed"
          value={summary?.rsvp_confirmed ?? 0}
          icon={CalendarDays}
          color="gold"
        />
        <StatCard
          title="Pending Arrival"
          value={scanStats?.pending ?? 0}
          icon={TrendingUp}
          subtitle="Not yet scanned"
          color="purple"
        />
      </div>

      {/* Arrival timeline chart */}
      {scanStats?.timeline && scanStats.timeline.length > 0 && (
        <Card title="Arrival Timeline">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scanStats.timeline} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                name="Arrivals"
                fill="#c9a84c"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <Card title="Upcoming Events">
          <div className="space-y-3">
            {upcoming.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="flex items-center justify-between p-4 rounded-xl
                           border border-gray-100 hover:border-gold-300
                           hover:bg-gold-50/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg bg-navy-100 flex items-center
                                  justify-center text-navy-700 font-bold text-sm group-hover:bg-navy-200"
                  >
                    {new Date(event.event_date).getDate()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.venue_name} · {formatDate(event.event_date)}
                    </p>
                  </div>
                </div>
                <Badge label={event.status} />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
