use crate::channels::traits::{MessageChannel, ChannelKind};
use crate::channels::sms::SmsChannel;
use crate::channels::whatsapp::WhatsAppChannel;
use crate::channels::email::EmailChannel;
use crate::channels::telegram::TelegramChannel;

pub fn get_channel(kind: ChannelKind) -> Box<dyn MessageChannel> {
    match kind {
        ChannelKind::Sms => Box::new(SmsChannel::new()),
        ChannelKind::WhatsApp => Box::new(WhatsAppChannel::new()),
        ChannelKind::Email => Box::new(EmailChannel::new()),
        ChannelKind::Telegram => Box::new(TelegramChannel::new()),
    }
}
