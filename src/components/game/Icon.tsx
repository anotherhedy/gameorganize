import React from 'react';
import { User, Calendar, Clock, Monitor, Smartphone, ArrowRight, ExternalLink, Globe, BookOpen, Star, Volume2, VolumeX, Coffee, Ghost } from 'lucide-react';

export const Icons = {
  User: ({ className }: { className?: string }) => <User className={className} size={16} />,
  Calendar: ({ className }: { className?: string }) => <Calendar className={className} size={16} />,
  Clock: ({ className }: { className?: string }) => <Clock className={className} size={16} />,
  Monitor: ({ className }: { className?: string }) => <Monitor className={className} size={16} />,
  Smartphone: ({ className }: { className?: string }) => <Smartphone className={className} size={16} />,
  Globe: ({ className }: { className?: string }) => <Globe className={className} size={16} />,
  ArrowRight: ({ className }: { className?: string }) => <ArrowRight className={className} size={20} />,
  ExternalLink: ({ className }: { className?: string }) => <ExternalLink className={className} size={14} />,
  BookOpen: ({ className }: { className?: string }) => <BookOpen className={className} size={16} />,
  Star: ({ className, fill }: { className?: string, fill?: string }) => <Star className={className} size={14} fill={fill} />,
  Volume2: ({ className }: { className?: string }) => <Volume2 className={className} size={16} />,
  VolumeX: ({ className }: { className?: string }) => <VolumeX className={className} size={16} />,
  Coffee: ({ className }: { className?: string }) => <Coffee className={className} size={16} />,
  Ghost: ({ className }: { className?: string }) => <Ghost className={className} size={16} />,
};
