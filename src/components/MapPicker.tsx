import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

// Help the map follow coordinate changes and fix rendering
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  useEffect(() => {
    // Fix for map rendering gray when it mounts in a container that might not have finalized its size
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);
  return null;
}

// Fix for default marker icons in Leaflet with Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  lat: number;
  lng: number;
  radius?: number;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}

function LocationMarker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return lat !== 0 ? (
    <Marker
      position={[lat, lng]}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          onChange(position.lat, position.lng);
        },
      }}
    />
  ) : null;
}

export default function MapPicker({
  lat,
  lng,
  radius,
  onChange,
  height = "300px",
}: MapPickerProps) {
  const [center, setCenter] = useState<[number, number]>([
    lat || -6.2,
    lng || 106.816666,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (lat && lng && (lat !== center[0] || lng !== center[1])) {
      setCenter([lat, lng]);
    }
  }, [lat, lng]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        setCenter([newLat, newLng]);
        onChange(newLat, newLng);
      } else {
        toast.error("Error");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error");
    } finally {
      setIsSearching(false);
    }
  };

  const useMyLocation = () => {
    if (navigator.geolocation) {
      const getLoc = (highAcc: boolean) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const newLat = pos.coords.latitude;
            const newLng = pos.coords.longitude;
            setCenter([newLat, newLng]);
            onChange(newLat, newLng);
          },
          (err) => {
            if (highAcc) {
              getLoc(false);
            } else {
              toast.error("Error");
            }
          },
          {
            enableHighAccuracy: highAcc,
            timeout: highAcc ? 8000 : 15000,
            maximumAge: 0,
          },
        );
      };
      getLoc(true);
    } else {
      toast.error("Error");
    }
  };

  return (
    <div className="relative group">
      <div className="absolute top-4 left-4 right-4 z-[500] flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari alamat atau tempat..."
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Cari</span>
          </button>
        </form>
        <button
          onClick={useMyLocation}
          type="button"
          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          <span className="whitespace-nowrap">Lokasi Saya</span>
        </button>
      </div>

      <div
        className="rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <ChangeView center={center} />
          <TileLayer
            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          />
          <LocationMarker lat={lat} lng={lng} onChange={onChange} />
          {lat !== 0 && radius && (
            <Circle
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
