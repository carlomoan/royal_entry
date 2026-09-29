"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Download, QrCode, User, Mail, Phone, Calendar, MapPin,
  CreditCard, CheckCircle, XCircle, Clock, Share2, Printer, Smartphone
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Card, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function GuestCardPage() {
  const router = useRouter();
  const { id: eventId, guestId } = router.query;
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [renderedCardUrl, setRenderedCardUrl] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  // Fetch guest data
  const { data: guestData, isLoading: guestLoading, error: guestError } = useQuery({
    queryKey: ["guest-card", eventId, guestId],
    queryFn: async () => {
      if (!eventId || !guestId) return null;
      const response = await api.get(`/events/${eventId}/guests/${guestId}`);
      return response.data.data;
    },
    enabled: !!eventId && !!guestId,
  });

  // Fetch event data
  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const response = await api.get(`/events/${eventId}`);
      return response.data.data;
    },
    enabled: !!eventId,
  });

  // Fetch invitations to find this guest's invitation
  const { data: invitationsData } = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const response = await api.get(`/events/${eventId}/invitations`);
      return response.data.data || [];
    },
    enabled: !!eventId,
  });

  // Fetch pledge data for this guest
  const { data: pledgesData } = useQuery({
    queryKey: ["pledges", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const response = await api.get(`/events/${eventId}/michango?per_page=500`);
      return response.data.data || [];
    },
    enabled: !!eventId,
  });

  const guest = guestData;
  const event = eventData;
  const invitations = invitationsData || [];
  const pledges = pledgesData || [];

  // Find this guest's invitation
  const invitation = invitations.find((inv: any) => inv.guest_id === guestId);

  // Find this guest's pledge
  const pledge = pledges.find((p: any) => p.guest_id === guestId);

  // Generate QR code URL when invitation is available
  useEffect(() => {
    if (invitation?.id && eventId) {
      const fetchQr = async () => {
        try {
          const response = await api.get(
            `/events/${eventId}/invitations/${invitation.id}/qr`,
            { responseType: "blob" }
          );
          const url = URL.createObjectURL(response.data);
          setQrUrl(url);
        } catch (error) {
          console.error("Failed to load QR code:", error);
          setQrUrl(null);
        }
      };
      fetchQr();

      // Fetch server-rendered card
      const fetchRenderedCard = async () => {
        try {
          const response = await api.get(
            `/events/${eventId}/invitations/${invitation.id}/render-card`,
            { responseType: "blob" }
          );
          const url = URL.createObjectURL(response.data);
          setRenderedCardUrl(url);
        } catch (error) {
          console.error("Failed to load rendered card:", error);
          setRenderedCardUrl(null);
        }
      };
      fetchRenderedCard();
    }
  }, [invitation?.id, eventId]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
      }
      if (renderedCardUrl) {
        URL.revokeObjectURL(renderedCardUrl);
      }
    };
  }, [qrUrl, renderedCardUrl]);

  useEffect(() => {
    if (guestError) {
      toast.error('Failed to load guest information');
    }
  }, [guestError]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (invitation?.public_url) {
      try {
        await navigator.clipboard.writeText(invitation.public_url);
        toast.success('Card link copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy link');
      }
    } else {
      toast.error('No invitation link available');
    }
  };

  const handleDownload = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!cardRef.current) {
      toast.error('Card not ready for download');
      return;
    }
    try {
      if (format === 'png' || format === 'jpeg') {
        toast.success(`Use browser print function to save as ${format.toUpperCase()}`);
        window.print();
      } else if (format === 'pdf') {
        window.print();
        toast.success('Use print dialog to save as PDF');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download card');
    }
  };

  const isLoading = guestLoading || eventLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-50 to-gold-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-800 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading guest card...</p>
        </div>
      </div>
    );
  }

  if (!guest || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-50 to-gold-50">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Guest Not Found</h2>
          <p className="text-slate-600 mb-4">The requested guest card could not be found.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Determine payment status
  const paymentStatus = pledge?.payment_status || 'no_pledge';
  const isPaid = paymentStatus === 'paid';
  const pledgedAmount = pledge?.pledged_amount || 0;
  const amountPaid = pledge?.amount_paid || 0;
  const remainingAmount = pledgedAmount - amountPaid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-white to-gold-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => router.back()} variant="ghost" className="text-navy-800">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Event
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleShare} variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
          </div>
        </div>

        {/* Guest Card */}
        <div ref={cardRef} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-1">{guest.full_name}</h1>
                <p className="text-navy-200 text-sm">Invitation Card</p>
                {guest.guest_category && guest.guest_category !== 'Regular' && (
                  <Badge label={guest.guest_category} variant="gold" className="mt-2 bg-white/10 text-white border-white/20" />
                )}
              </div>
              <Badge
                label={paymentStatus === 'paid' ? 'Fully Paid' :
                  paymentStatus === 'partial' ? 'Partial Payment' :
                    paymentStatus === 'no_pledge' ? 'No Pledge' :
                      paymentStatus}
                variant={isPaid ? "success" : paymentStatus === 'partial' ? "warning" : "slate"}
                className="bg-white/10 text-white border-white/20"
              />
            </div>
          </div>

          {/* Card Content */}
          <div className="p-6">
            {/* Event Information */}
            <div className="mb-6 pb-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-navy-800 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-gold-600" /> Event Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Event Name</p>
                  <p className="font-semibold text-slate-800">{event.title}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Date & Time</p>
                  <p className="font-semibold text-slate-800">
                    {event.event_date ? formatDate(event.event_date) : 'TBD'}
                    {event.event_time && ` at ${event.event_time}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Venue</p>
                  <p className="font-semibold text-slate-800">{event.venue_name || 'TBD'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Location</p>
                  <p className="font-semibold text-slate-800 flex items-center">
                    <MapPin className="h-4 w-4 mr-1 text-gold-600" />
                    {event.venue_address || 'TBD'}
                  </p>
                </div>
                {event.main_characters && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-slate-500 mb-1">Main Characters</p>
                    <p className="font-semibold text-slate-800">{event.main_characters}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Guest Information */}
            <div className="mb-6 pb-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-navy-800 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-gold-600" /> Guest Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Full Name</p>
                  <p className="font-semibold text-slate-800">{guest.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Device Type</p>
                  <p className="font-semibold text-slate-800 flex items-center">
                    <Smartphone className="h-4 w-4 mr-1 text-gold-600" />
                    {guest.device_type === 'feature_phone' ? 'Feature Phone' : 'Smartphone'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Phone</p>
                  <p className="font-semibold text-slate-800 flex items-center">
                    <Phone className="h-4 w-4 mr-1 text-gold-600" />
                    {guest.phone || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="font-semibold text-slate-800 flex items-center">
                    <Mail className="h-4 w-4 mr-1 text-gold-600" />
                    {guest.email || 'Not provided'}
                  </p>
                </div>
                {guest.table_number && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Table Number</p>
                    <p className="font-semibold text-slate-800">Table {guest.table_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500 mb-1">Contact Method</p>
                  <p className="font-semibold text-slate-800">{guest.contact_method || 'Not specified'}</p>
                </div>
                {invitation && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Invitation Status</p>
                    <Badge label={invitation.status || 'Not sent'} variant={invitation.status === 'sent' ? 'blue' : 'slate'} />
                  </div>
                )}
              </div>
            </div>

            {/* Payment Information */}
            {pledge && (
              <div className="mb-6 pb-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-navy-800 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-gold-600" /> Payment Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-500 mb-1">Pledged Amount</p>
                    <p className="text-xl font-bold text-navy-800">
                      TZS {pledgedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-500 mb-1">Amount Paid</p>
                    <p className="text-xl font-bold text-green-600">
                      TZS {amountPaid.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-500 mb-1">Remaining</p>
                    <p className={`text-xl font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      TZS {remainingAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
                {paymentStatus === 'partial' && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Partial payment received. Remaining balance: TZS {remainingAmount.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center py-6">
              <h2 className="text-lg font-semibold text-navy-800 mb-4 flex items-center">
                <QrCode className="h-5 w-5 mr-2 text-gold-600" /> Check-in QR Code
              </h2>
              <div className="bg-white border-2 border-slate-200 rounded-lg p-4 shadow-inner">
                {guest.device_type === 'feature_phone' && invitation?.scan_payload ? (
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold tracking-[0.3em] text-navy-800 mb-2">
                      {invitation.scan_payload}
                    </p>
                    <p className="text-xs text-slate-500">Manual check-in code</p>
                  </div>
                ) : qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Guest check-in QR code"
                    className="h-48 w-48"
                  />
                ) : (
                  <div className="w-48 h-48 bg-slate-100 flex items-center justify-center">
                    <div className="text-center">
                      <QrCode className="h-16 w-16 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">
                        {invitation ? 'QR Code Loading...' : 'No invitation generated'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {invitation?.public_url && (
                <p className="mt-4 text-sm text-slate-600 text-center">
                  Scan this code at the event entrance for check-in
                </p>
              )}
            </div>
          </div>

          {/* Card Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Generated by RoyalEntry • {new Date().toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => handleDownload('png')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" /> PNG
                </Button>
                <Button onClick={() => handleDownload('jpeg')} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" /> JPEG
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-navy-800 mb-2">Card Instructions</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Present this card at the event entrance for check-in</li>
            <li>• Show the QR code to the scanner attendant</li>
            {guest.device_type === 'feature_phone' && (
              <li>• For feature phones, provide the manual check-in code shown above</li>
            )}
            <li>• Keep this card accessible during the event</li>
            {pledge && paymentStatus !== 'paid' && (
              <li className="text-amber-700">• Complete your pledge payment of TZS {remainingAmount.toLocaleString()}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}