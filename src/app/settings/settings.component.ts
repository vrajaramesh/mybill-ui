import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { ThermalPrinterService } from '../thermal-printer.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  firmName    = '';
  gstNumber   = '';
  address     = '';
  waPhone     = '';
  logoPreview = '';

  firmSaved    = false;
  gstSaved     = false;
  addressSaved = false;
  logoSaved    = false;
  waSaved      = false;
  printerPairing = false;

  constructor(
    private settings: SettingsService,
    public  printer:  ThermalPrinterService
  ) {}

  ngOnInit(): void {
    this.firmName    = this.settings.firmName;
    this.gstNumber   = this.settings.gstNumber;
    this.address     = this.settings.address;
    this.waPhone     = this.settings.whatsappPhone;
    this.logoPreview = this.settings.logo;
  }

  saveFirm(): void {
    this.settings.saveFirmName(this.firmName);
    this.firmSaved = true;
    setTimeout(() => this.firmSaved = false, 2000);
  }

  saveGst(): void {
    this.settings.saveGstNumber(this.gstNumber);
    this.gstSaved = true;
    setTimeout(() => this.gstSaved = false, 2000);
  }

  saveAddress(): void {
    this.settings.saveAddress(this.address);
    this.addressSaved = true;
    setTimeout(() => this.addressSaved = false, 2000);
  }

  saveWa(): void {
    this.settings.saveWhatsappPhone(this.waPhone);
    this.waSaved = true;
    setTimeout(() => this.waSaved = false, 2000);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, SVG, etc.)');
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      // Resize to max 200px height to keep localStorage size small
      const maxH = 200;
      const scale = img.height > maxH ? maxH / img.height : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png', 0.85);
      URL.revokeObjectURL(objectUrl);
      this.logoPreview = dataUrl;
    };
    img.src = objectUrl;
  }

  saveLogo(): void {
    if (!this.logoPreview) return;
    this.settings.saveLogo(this.logoPreview);
    this.logoSaved = true;
    setTimeout(() => this.logoSaved = false, 2000);
  }

  clearLogo(): void {
    this.logoPreview = '';
    this.settings.clearLogo();
  }

  async pairPrinter(): Promise<void> {
    if (!this.printer.supported) {
      alert('Web Bluetooth is not supported.\nUse Chrome or Edge over HTTPS / localhost.');
      return;
    }
    this.printerPairing = true;
    const ok = await this.printer.pair();
    this.printerPairing = false;
    if (!ok) alert('Could not connect to printer.\nMake sure your Bluetooth thermal printer is powered on and in pairing mode.');
  }

  disconnectPrinter(): void {
    this.printer.disconnect();
  }
}
