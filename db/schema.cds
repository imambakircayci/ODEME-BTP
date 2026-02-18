namespace btp.api.db;

using { managed, cuid } from '@sap/cds/common';

// 1. ONAYCI GRUPLARI (Ana Tablo)
// Örn: DIR - Direktör, MDR - Müdür
entity ApproverGroups : managed {
    key GroupCode : String(10); // DIR, MDR
    Description   : String(100); // Açıklama
    
    // İlişkiler
    Users         : Association to many ApproverUsers on Users.Group = $self;
    Determinations: Association to many ApprovalDetermination on Determinations.ApproverGroup = $self;
}

// 2. ONAYCI KULLANICILARI (Bağlı Tablo)
// Örn: DIR grubunda AHMET kullanıcısı var
entity ApproverUsers : managed, cuid {
    Group       : Association to ApproverGroups; // Foreign Key (Sadece var olan gruplar seçilebilir)
    Counter     : Integer; // Onaycı Sırası (1, 2, 3...)
    Username    : String(50); // SAP Kullanıcı Adı (IIREM)
    LimitAmount : Decimal(15,2); // Onay Limiti
    Currency    : String(3) default 'TRY';
}

// 3. ONAY GRUBU BELİRLEME (Matris)
// Şirket Kodu + Talep Tipi -> Hangi Grup?
entity GroupDetermination : managed, cuid {
    CompanyCode : String(4); // 1000
    ProfitCenter: String(10);
    CostCenter  : String(10);
    RequestType : String(20); // Fatura, Avans
    
    // Sonuç: Hangi Gruba Gidecek?
    TargetGroup : Association to ApproverGroups;
}

// 4. ONAYCI BELİRLEME (Sıralı Onay)
// Grup -> Sıra -> Tanım
entity ApprovalDetermination : managed, cuid {
    ApproverGroup : Association to ApproverGroups;
    StepNumber    : Integer; // 1. Onay, 2. Onay
    StepDescription: String(100); // "Müdür Onayı"
}

// 5. ÖDEME YAPAN ŞİRKET KODLARI
entity PayingCompanyCodes : managed {
    key CompanyCode : String(4);
    Description     : String(100);
}
