ALTER TABLE "cashflows" DROP CONSTRAINT "chk_cashflows_category";--> statement-breakpoint
ALTER TABLE "cashflows" DROP CONSTRAINT "chk_cashflows_direction_category";--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "chk_cashflows_category" CHECK (category in ('CLIENT_PAYMENT', 'CREW_PAYMENT', 'VENDOR_PAYMENT', 'TRANSPORT', 'EQUIPMENT', 'OTHER', 'INTERNET', 'ELECTRICITY', 'SALARY', 'RENT', 'SUPPLIES'));--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "chk_cashflows_direction_category" CHECK ((direction = 'INCOME' and category = 'CLIENT_PAYMENT')
          or (direction = 'EXPENSE' and category in ('CREW_PAYMENT', 'VENDOR_PAYMENT', 'TRANSPORT', 'EQUIPMENT', 'OTHER', 'INTERNET', 'ELECTRICITY', 'SALARY', 'RENT', 'SUPPLIES')));