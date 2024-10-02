
uses amica.bc.Billing.AccountingDate.helper.AccountingDateHelper
uses amica.bc.entitybuilder.helper.PolicyPeriodBuilderHelper
uses amica.bc.helpers.admin.invoicepreview.PaymentPlanNames
uses amica.bc.payments.BillingPaymentImpl
uses amica.bc.payments.PaymentInstrumentFactory
uses amica.bc.payments.production.vo.CashCheckPaymentRequest
uses amica.bc.payments.webservice.BillingPaymentAPI
uses amica.bc.util.PolicyUtils
uses amica.bc.util.UDEUtil
uses amica.bc.util.creation.AccountCreationUtil
uses amica.dao.AccountDAO
uses amica.dao.ChargePatternDAO
uses amica.dao.DisbursementDAO
uses amica.dao.PlanDAO
uses entity.Contact
uses gw.api.database.Query
uses gw.api.databuilder.ChargeBuilder
uses gw.api.util.CurrencyUtil
uses gw.api.util.DateUtil
uses gw.api.web.payment.DirectBillPaymentFactory
uses gw.pl.currency.MonetaryAmount
uses gw.pl.persistence.core.Bundle
uses gw.webservice.bc.bc1000.PaymentInstrumentRecord
uses gw.webservice.bc.bc1000.PaymentReceiptRecord
uses gw.webservice.policycenter.bc1000.BillingAPI
uses gw.webservice.policycenter.bc1000.PCPaymentPlanInfoRequest
uses gw.webservice.policycenter.bc1000.entity.anonymous.elements.BillingInstructionInfo_ChargeInfos
uses gw.webservice.policycenter.bc1000.entity.anonymous.elements.PCAccountInfo_InsuredContact
uses gw.webservice.policycenter.bc1000.entity.anonymous.elements.PolicyChangeInfo_PrimaryNamedInsuredContact
uses gw.webservice.policycenter.bc1000.entity.types.complex.CancelPolicyInfo
uses gw.webservice.policycenter.bc1000.entity.types.complex.IssuePolicyInfo
uses gw.webservice.policycenter.bc1000.entity.types.complex.PCAccountInfo
uses gw.webservice.policycenter.bc1000.entity.types.complex.PolicyChangeInfo
uses gw.webservice.policycenter.bc1000.entity.types.complex.RenewalInfo
uses gw.webservice.policycenter.bc1000.entity.types.complex.RewriteInfo
uses gw.xml.date.XmlDateTime

uses gw.webservice.policycenter.bc1000.entity.anonymous.elements.PolicyChangeInfo_PolicyContacts

uses java.math.BigDecimal
uses java.util.Currency

var policyType = "auto"
policyType = "home"

var api = new BillingAPI()
var random = new Random().nextInt(999999999)
var builder = new StringBuilder()
var policyPeriod : PolicyPeriod = null
var t = true
var f = false
var curr = typekey.Currency.TC_USD.Code
var activeUser = "su"

/**
 * --- UserPick ---
 * 0 Create Account via PC api
 * 1 issuance
 * 2 policyChange
 * 3 cancellation
 * 4 renewal
 * 5 make DBMR
 * 6 make SuspensePayment
 * 7 enroll in APP
 * 8 unenroll from APP
 * 9 create listbill account
 * 10 does nothing - place holder
 * 11 change account bill due date
 * 12 Preview MTC
 * 13 does nothing - place holder
 * 14 Transfer policyNumberLong to acctNumber
 * 15 Create Cancellation Fee
 * 16 update disbursement data
 * 17 Create Recapture  Charge
 * 18 Create Covid Credit Phase Two
 * 19 Create CashCheckRequest object for account
 * 20 Rewrite Cancelled Policy
 */

// TXVFDAssmt
// N100020009

var userPick = 1
if (policyType.equalsIgnoreCase("home")) {userPick = 2}

var dateParam = "11/28/2024".toDate()
var uwCompanyCode = UWCompany.TC_0028_19976.Code
var state = "MA"
var listBillAccountNumber = "L100020004"
//AMICA_PAYROLL_ACCOUNT_NO
var acctNumber = "N100020035"
var policyNumberLong = 9926140318 as String
var chargePatternParam = "Premium"
var premAmount = 44 as String
var divDist = ApplyDividendTypeExt.TC_APPLYDIVIDENDFIRST.Code
var isDivPol = f

var withCharges = t

var useListBill = f
if (policyType.equalsIgnoreCase("home")) {useListBill = t}

var useAPP = f
var isMaip = f
var isBulk = f
var isPif = f
var semi = f
var isOOSE = f
var isDiocese = listBillAccountNumber == AccountDAO.AMICA_DIOCESE_ACCOUNT_NO and useListBill
var bulkWord = "BulkRateTest"
var producerCode = "0100300"


var productCode = LOBCode.TC_PERSONALAUTO.Code
var subType = "privatepassenger"


var paymentPlan = PlanDAO.getPaymentPlanByName( PaymentPlanNames.FULLPAY ).PublicID

if (policyType.equalsIgnoreCase("home")) {
  paymentPlan = PlanDAO.getPaymentPlanByName( PaymentPlanNames.MORTGAGEE_PAYPLAN ).PublicID
  productCode = LOBCode.TC_HOMEOWNERS.Code
  subType = "ho3"
}


var policyTermType = PolicyPeriodTermTypeExt.TC_ANNUAL.Code
var offerNumber = "Q"+acctNumber
var usePolicyPeriodToMakePayment = t
var policyNumberStarter = getPolicyNumberStarter( productCode )
var idm = 15
var map = new HashMap<String, BigDecimal>()
var list = new ArrayList<String>()
//addItemsToList({buildCharge("TXVFDAssmt", 0.04 as String)})
addItemsToList({buildCharge(chargePatternParam, premAmount)})

builder = new StringBuilder()
var errorMessage = "Policy doesnt exist"

doWork(userPick)
//dataChangeAPI()

function dataChangeAPI() {
  var  p = getPolicyPeriod()

  gw.transaction.Transaction.runWithNewBundle(\ bundle ->{
    p = bundle.add( p )
    p.SemiAnnualPIFDiscountExt = true
  }, activeUser)

}

function doWork(input : int){
  if( {2,3,4,12,14}.contains(input) ){
    policyPeriod = getPolicyPeriod()
  }

  switch( input ) {
    case 0:
      print("Hey we be trying to create an account")
      var info = createAccountVIAPCAccountInfo()
      gw.transaction.Transaction.runWithNewBundle(\bundle -> {
        new BillingAPI().createAccount(info, typekey.Currency.TC_USD, builder.append(random).toString())
      }, activeUser)
      break
    case 1:
      print("Hey we processed a policy")
      try {
        processPolicyIssuance(dateParam, acctNumber, paymentPlan)
      } catch(ex : Exception){
        ex.printStackTrace()
      }
      print("Finished")
      break
    case 2:
      print("Hey we changed a policy")
      if (policyPeriod != null) {
        processPolicyChangeReqs()
      } else{
        print(errorMessage)
      }
      print("Finished")
      break
    case 3:
      print("Hey we are cancelling a policy")
      if( policyPeriod != null )
        processPolicyCancellation(dateParam)
      else
        print(errorMessage)
      break
    case 4:
      print("Hey we are renewing a policy")
      if( policyPeriod != null )
        processPolicyRenewal(acctNumber, dateParam, paymentPlan)
      else
        print(errorMessage)
      break
    case 5:
      print("Making Payment")
      policyPeriod = getPolicyPeriod()
      gw.transaction.Transaction.runWithNewBundle(\bundle -> {
        var details = createDetails(acctNumber, policyNumberLong, premAmount)
        var account = useListBill ? AccountDAO.getAccountByAccountNumber(listBillAccountNumber)
            : AccountDAO.getAccountByAccountNumber(policyPeriod.Account.AccountNumber)

        if (not usePolicyPeriodToMakePayment) {
          policyPeriod = null
        }
        makeDirectBillPayment(details, account)
      }, activeUser)

      print("Finished Payment")
      break
    case 6:
      createDBMRWithSuspenseItem()
      break
    case 7:
      updateAPPInformation(true)
      break
    case 8:
      updateAPPInformation(false)
      break
    case 9:
      print("Creating List Bill Account")
      createServiceProvider()
      break
    case 10:
      makeSuspensePayment()
      print("Done")
      break
    case 11:
      var a = AccountDAO.getAccountByAccountNumber(acctNumber)
      gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
        a = bundle.add(a)
        a.InvoiceDayOfMonth = idm
      }, activeUser)
      print("Done")
      break
    case 12:
      if( policyPeriod != null ){
        var changeInfo = processPolicyChange("abc:12345")
        var preview = api.previewInstallmentsPlanInvoicesExt(changeInfo, dateParam)
        for( item in preview ){
          print( item.InvoiceBillDate + " " + item.InvoiceDueDate )
        }
      }
      else
        print(errorMessage)
      break
    case 13:
      var issuePolicyInfo = buildIssuePolicyInfo(dateParam, acctNumber, paymentPlan, "12345")
      var invoiceDayOfMonth = 15
      var issuance : Issuance = null
      if (invoiceDayOfMonth < 1 or invoiceDayOfMonth > 31) {
        invoiceDayOfMonth = DateUtil.currentDate().DayOfMonth
      }
      issuance = issuePolicyInfo.toIssuanceForPreview_Ext(invoiceDayOfMonth)
      //var invoiceItemPreviews = BillingAPI.createInvoiceItemsPreview(issuance.NewPolicyPeriod.InvoiceItems)
      break
    case 14:
      print("Under construction for upgrade")
      break
    case 15:
      var account = AccountDAO.getAccountByAccountNumber(acctNumber)
      var pp = getPolicyPeriod()

      gw.transaction.Transaction.runWithNewBundle(\ bundle ->{
        var dlnqProcess = bundle.add( pp.ActiveDelinquency )
        dlnqProcess.chargeCancelFee()
      })
      break
    case 16:
      var account = AccountDAO.getAccountByAccountNumber(acctNumber)
      var disb = DisbursementDAO.getAccountDisbursementsForAccount(account).first()
      gw.transaction.Transaction.runWithNewBundle(\ bundle ->{
        disb = bundle.add(disb)
        var o = disb.OutgoingPayment
        disb.DueDate = DateUtil.currentDate().addYears(-1)
        if( disb.OutgoingPayment != null ){
          o = bundle.add(o)
          o.Status = OutgoingPaymentStatus.TC_ISSUED
          o.IssueDate = DateUtil.currentDate().addYears(-1)
          o.StatusDateExt =  DateUtil.currentDate().addYears(-1)
          o.IsCheckProcessedExt = false
          o.PaymentInstrument = PaymentInstrumentFactory.getImmutableCheckPI()
        }
      }, activeUser)
      print("Changed all the data")
      break
    case 17:

      var account = AccountDAO.getAccountByAccountNumber(acctNumber)
      var cp = ChargePatternDAO.getChargePatternByChargeCode("Recapture")
      var recaptureCharge = new ChargeBuilder().onAccountWithAccountGeneralBI(account)
          .asChargePattern(cp)
          .withRecaptureUnappliedFund(account.DefaultUnappliedFund)
          .withAmount(new MonetaryAmount(premAmount+ " usd")).createAndExecuteBillingInstruction()
      print( recaptureCharge.TAccountOwner )
      print("Hey we created a recapture charge")
      break
    case 18:
      createCovidCredit()
      print("Jankiness done")
      break
    case 19:
      buildCashCheckRequest()
      gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
        var impl = new BillingPaymentAPI()
        impl.addCashCheckPayment(buildCashCheckRequest())
      },"su")
      print("Made a payment on ${acctNumber}")
      break
    case 20:
      processPolicyRewrite(acctNumber, dateParam, paymentPlan)
      break
    default:
      print("Bad input. You suck")
      break
  }
}

function buildRequestObject() : PCPaymentPlanInfoRequest {
  var pcRequest = new PCPaymentPlanInfoRequest()
  pcRequest.ExpiringPolicyNumber = ""
  pcRequest.LineOfBusiness = productCode
  pcRequest.PaidInFull = false
  pcRequest.SourceOfBusiness = SourceOfBusinessExt.TC_DIRECTMAIL.Code
  pcRequest.State = policyPeriod.RiskJurisdiction.Code
  pcRequest.UnderWritingCompany = UWCompany.TC_0028_19976.Code
  pcRequest.WaiveOrReduce = false
  pcRequest.PolicyEffectiveDate = dateParam
  pcRequest.TermTypeExt = policyTermType
  pcRequest.State = "CO"
  return pcRequest
}

function createCovidCredit(){
  var pp = getPolicyPeriod()
  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    pp = bundle.add(pp)
    var accountGeneralBI = new General(pp.Bundle, pp.Currency)
    accountGeneralBI.AssociatedPolicyPeriod = pp
    var covidCreditAmount = new MonetaryAmount(new BigDecimal(premAmount), pp.Currency)
    accountGeneralBI.buildCharge(covidCreditAmount, gw.api.web.accounting.ChargePatternHelper.getChargePattern("CovidCredit"))
    accountGeneralBI.ModificationDate = DateUtil.currentDate()
    accountGeneralBI.execute()
  }, activeUser)
}

private function getPolicyPeriod() : PolicyPeriod {
  return Query.make(entity.PolicyPeriod).compare("PolicyNumberLong",Equals,policyNumberLong).select().FirstResult
}

private function getPolicyNumberStarter(code : String) : String {
  var starter = ""
  switch( code ){
    case LOBCode.TC_PERSONALAUTO.Code:
      starter = "9"
      break
    default:
      starter = "6"
      break
  }
  return starter
}

private function buildIssuePolicyInfo(date : Date, accountNumber : String, plan : String, transID : String) : IssuePolicyInfo {
  var req = new IssuePolicyInfo()
  req.EffectiveDate = UDEUtil.formatToXmlDate(date)
  req.PeriodStart = UDEUtil.formatToXmlDate(date)
  req.PeriodEnd = getPolicyExpirationDate(date)
  req.ModelDate = UDEUtil.formatToXmlDate(date)
  req.TermNumber = 1
  req.OfferNumber = offerNumber != null ? offerNumber : "Q000000001"
  req.PriorInsuredIndExt = false
  req.PaidInFullDiscountIndExt = isPif
  req.AutoPayEligibilityExt = useAPP
  req.AssignedRisk = false
  req.MAIPIndExt = isMaip
  req.DividendPolicyExt = false
  req.EDiscountExt = false
  req.PaymentPlanPublicId = plan
  req.BillingMethodCode = not useListBill ? "DirectBill" : "ListBill"
  req.PolicyNumber = getPolicyNumber()
  req.TermTypeExt = policyTermType
  req.DividendDistributionExt = divDist
  req.DividendPolicyExt = isDivPol
  req.ProductCode = producerCode
  req.DioceseIndExt = isDiocese
  req.PolicySubTypeExt = subType
  req.ProductCode = productCode
  req.SemiAnnualDiscountIndExt = semi
  req.SemiAnnualPIFDiscount = req.SemiAnnualDiscountIndExt

  if( withCharges ){
    var bis = buildChargeInfo(dateParam)
    for( bi in bis ){
      req.ChargeInfos.add(bi)
    }
  }

  //req.StateCode = state
  var cont = new PolicyChangeInfo_PrimaryNamedInsuredContact(){
    :PublicID = transID,
    :AddressBookUID = transID,
    :ContactType = "Person",
    :ContactRoleType = "Primary Policy Owner",
    :PartyUUIDExt = 1231994
  }
  req.PrimaryNamedInsuredContact = cont

  req.AccountNumber = accountNumber
  req.UWCompanyCode = uwCompanyCode
  req.ProductCode = productCode
  req.Currency = curr
  req.JurisdictionCode = state

  if( useListBill and not isDiocese ){
    req.AltBillingAccountNumber = listBillAccountNumber
    req.InvoiceStreamId = AccountDAO.getAccountByAccountNumber(listBillAccountNumber).InvoiceStreams.first().PublicID
  } else if ( isDiocese ){
    req.AltBillingAccountNumber = AccountDAO.AMICA_DIOCESE_ACCOUNT_NO
    print( AccountDAO.getDioceseAccount() )
    print( AccountDAO.AMICA_DIOCESE_ACCOUNT_NO )
    req.InvoiceStreamId = AccountDAO.getDioceseAccount().InvoiceStreams.first().PublicID
    //AccountDAO.getAccountByAccountNumber(listBillAccountNumber).InvoiceStreams.first().PublicID
  }
  return req
}

private function processPolicyIssuance(date : Date, accountNumber : String, plan : String){
  var transID = builder.append(random).toString()
  var req = buildIssuePolicyInfo(date, accountNumber, plan, transID)

  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    api.issuePolicyPeriod(req, transID)
  }, activeUser)
}

private function processPolicyChange(transID : String) : PolicyChangeInfo{
  var req = new PolicyChangeInfo()
  req.PolicyNumber = policyPeriod.PolicyNumber
  req.EffectiveDate = UDEUtil.formatToXmlDate(dateParam)
  req.PeriodStart = UDEUtil.formatToXmlDate(policyPeriod.EffectiveDate)
  req.PeriodEnd = UDEUtil.formatToXmlDate(policyPeriod.ExpirationDate)
  req.TermNumber = policyPeriod.TermNumber
  req.TermConfirmed = true
  req.PriorInsuredIndExt = false
  req.PaidInFullDiscountIndExt = isPif
  req.AutoPayEligibilityExt = useAPP
  req.EDiscountExt = policyPeriod.isEligibleForEDiscountExt()
  req.TermTypeExt = policyTermType
  req.Description = isBulk ? bulkWord : null
  req.JurisdictionCode = policyPeriod.RiskJurisdiction.Code
  req.OOSEIndicatorExt = isOOSE
  req.PolicySubTypeExt = policyPeriod.PolicySubTypeExt.Code
  req.SemiAnnualDiscountIndExt = semi

  var cont = new PolicyChangeInfo_PrimaryNamedInsuredContact(){
    :PublicID = transID,
    :AddressBookUID = transID,
    :ContactType = "Person",
    :ContactRoleType = "Primary Policy Owner",
    :PartyUUIDExt = 1231994
  }

  // additionalinterest

  if (policyType.equalsIgnoreCase("home")) {

    var additional_interest_contact = new PolicyChangeInfo_PolicyContacts(){
      :PublicID = transID,
      :AddressBookUID = transID,
      :ContactType = "Company",
      :ContactRoleType = "Additional Interest",
      :PartyUUIDExt = 881241,
      :ServiceProviderIDExt = "2024-09-09 12:31:01.000944"
    }
    req.PolicyContacts.add(additional_interest_contact)
  }


  req.PrimaryNamedInsuredContact = cont


  if( withCharges ){
    var bis = buildChargeInfo(dateParam)
    for( bi in bis ){
      req.ChargeInfos.add(bi)
    }
  }

  //req.StateCode = state
  req.AltBillingAccountNumberExt = useListBill ? listBillAccountNumber : null
  req.PrimaryNamedInsuredContact.PartyUUIDExt = 1231994
  print(req.toString())
  return req
}

private function processPolicyChangeReqs(){
  var transID = builder.append(random).toString()
  var req = processPolicyChange(transID)
  req.print()
  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    api.changePolicyPeriod(req, transID)
  }, activeUser)
}

private function processPolicyCancellation(priorDate : Date){
  var req = new CancelPolicyInfo()
  req.EffectiveDate = UDEUtil.formatToXmlDate(priorDate)
  req.TermNumber = policyPeriod.TermNumber
  req.PriorInsuredIndExt = false
  req.PaidInFullDiscountIndExt = isPif
  req.AutoPayEligibilityExt = useAPP
  req.MAIPIndExt = isMaip
  req.CancellationType = CancellationType.TC_FLAT.Code
  req.TermTypeExt = policyTermType
  req.SemiAnnualDiscountIndExt = semi

  var bis = buildChargeInfo(dateParam)
  for( bi in bis ){
    req.ChargeInfos.add(bi)
  }

  req.AmicaPolicyNumberExt = policyPeriod.PolicyNumberLong
  req.PolicyNumber = policyPeriod.PolicyNumber

  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    api.cancelPolicyPeriod(req, builder.append(random).toString())
  }, activeUser)
}

private function processPolicyRewrite(accountNumber : String, date : Date, plan : String){
  var cancelRewrite = getPolicyPeriod()
  var req = new RewriteInfo()
  var transID = builder.append(random).toString()
  req.EffectiveDate = UDEUtil.formatToXmlDate( cancelRewrite.PolicyPerEffDate )
  req.PeriodStart = UDEUtil.formatToXmlDate( cancelRewrite.PolicyPerEffDate )
  req.PeriodEnd = getPolicyExpirationDate( cancelRewrite.PolicyPerExpirDate )
  req.ModelDate = UDEUtil.formatToXmlDate(date)
  req.TermNumber = cancelRewrite.TermNumber + 1
  req.MAIPIndExt = isMaip
  req.PriorInsuredIndExt = false
  req.PaidInFullDiscountIndExt = isPif
  req.AutoPayEligibilityExt = false
  req.EDiscountExt = false
  req.AssignedRisk = false
  req.APPEnrolledPartyUUIDExt = useAPP ? cancelRewrite.AutoPayPayerExt.PartyUUIDExt : null
  req.PaymentPlanPublicId = plan
  req.BillingMethodCode = cancelRewrite.BillingMethod.Code
  req.TermTypeExt = policyTermType
  req.DividendPolicyExt = cancelRewrite.DividendPolicyExt
  req.DividendDistributionExt = cancelRewrite.DividendDistributionExt.Code
  req.Currency = curr
  req.JurisdictionCode = cancelRewrite.RiskJurisdiction.Code
  req.SemiAnnualDiscountIndExt = cancelRewrite.SemiAnnualPIFDiscountExt
  req.OfferNumber = offerNumber


  if( withCharges ){
    var bis = buildChargeInfo(date)
    for( bi in bis ){
      req.ChargeInfos.add(bi)
    }
  }

  //req.StateCode = state
  var cont = new PolicyChangeInfo_PrimaryNamedInsuredContact(){
    :PublicID = transID,
    :AddressBookUID = transID,
    :ContactType = "Person",
    :ContactRoleType = "Primary Policy Owner",
    :PartyUUIDExt = 1231994
  }

  req.PrimaryNamedInsuredContact = cont
  req.AccountNumber = accountNumber
  req.UWCompanyCode= uwCompanyCode
  req.ProductCode = productCode
  req.PolicyNumber = getPolicyNumber()
  req.PriorPolicyNumber = cancelRewrite.PolicyNumber

  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    api.rewritePolicyPeriod(req, transID)
  }, activeUser)
}

private function processPolicyRenewal(accountNumber : String, date : Date, plan : String){
  var req = new RenewalInfo()
  var transID = builder.append(random).toString()
  req.EffectiveDate = UDEUtil.formatToXmlDate( getPolicyPeriod().PolicyPerEffDate.addYears(1) )
  req.PeriodStart = UDEUtil.formatToXmlDate( getPolicyPeriod().PolicyPerEffDate.addYears(1) )
  req.PeriodEnd = getPolicyExpirationDate( getPolicyPeriod().PolicyPerExpirDate )
  req.ModelDate = UDEUtil.formatToXmlDate(date)
  req.TermNumber = policyPeriod.TermNumber + 1
  req.MAIPIndExt = isMaip
  req.PriorInsuredIndExt = false
  req.PaidInFullDiscountIndExt = isPif
  req.AutoPayEligibilityExt = false
  req.EDiscountExt = false
  req.AssignedRisk = false
  req.APPEnrolledPartyUUIDExt = useAPP ? policyPeriod.AutoPayPayerExt.PartyUUIDExt : null
  req.PaymentPlanPublicId = plan
  req.BillingMethodCode = not useListBill ? "DirectBill" : "ListBill"
  req.TermTypeExt = policyTermType
  req.DividendPolicyExt = policyPeriod.DividendPolicyExt
  req.DividendDistributionExt = policyPeriod.DividendDistributionExt.Code
  req.Currency = curr
  req.JurisdictionCode = policyPeriod.RiskJurisdiction.Code
  req.SemiAnnualDiscountIndExt = getPolicyPeriod().SemiAnnualPIFDiscountExt

  if( useListBill ){
    req.AltBillingAccountNumber = listBillAccountNumber
    req.InvoiceStreamId = AccountDAO.getAccountByAccountNumber(listBillAccountNumber).InvoiceStreams.first().PublicID
  }

  if( withCharges ){
    var bis = buildChargeInfo(date)
    for( bi in bis ){
      req.ChargeInfos.add(bi)
    }
  }

  //req.StateCode = state
  var cont = new PolicyChangeInfo_PrimaryNamedInsuredContact(){
    :PublicID = transID,
    :AddressBookUID = transID,
    :ContactType = "Person",
    :ContactRoleType = "Primary Policy Owner",
    :PartyUUIDExt = 1231994
  }

  req.PrimaryNamedInsuredContact = cont
  req.AccountNumber = accountNumber
  req.UWCompanyCode= uwCompanyCode
  req.ProductCode = productCode
  req.PolicyNumber = getPolicyNumber()
  req.PriorPolicyNumber = policyPeriod.PolicyNumber

  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    api.renewPolicyPeriod(req, transID)
  }, activeUser)
}

function getPolicyNumber() : String{
  return PolicyUtils.convertToAmicaPolicyNumber( PolicyPeriodBuilderHelper.policyNumberLongGenerator(policyNumberStarter) )
}

function createDetailsPaymentRequest(accountNumber : String, policyNumber : String, amount : String) : amica.bc.payments.production.vo.PaymentRequest{
  var details = new amica.bc.payments.production.vo.PaymentRequest()
  details.AccountNumber = accountNumber
  details.Amount = new BigDecimal(amount)
  details.Q_Number = offerNumber
  details.PaymentMethod = PaymentMethod.TC_CASH.Code
  details.UserId = "su"

  return details
}

function createDetails(accountNumber : String, policyNumber : String, amount : String) : PaymentReceiptRecord {
  var details = new PaymentReceiptRecord()
  details.AccountNumber = accountNumber
  details.PolicyNumber = policyNumber
  details.MonetaryAmount = new MonetaryAmount(amount + " usd")
  details.BatchID = "3081"
  details.PaymentReceiptType = PaymentReceiptRecord.paymentReceiptType.DIRECTBILLMONEYDETAILS
  details.CheckImageURLExt = ""
  details.PaymentDate = DateUtil.currentDate()
  details.RefNumber = "ABC123".concat(random as String)
  var payInstRecord = new PaymentInstrumentRecord()
  payInstRecord.PaymentMethod = PaymentMethod.TC_CREDITCARD
  details.PaymentInstrumentRecord = payInstRecord
  details.Description = "Created by Lockbox Intake Process."
  details.ReceivedDate = DateUtil.currentDate()
  details.Payor = "System User"
  details.Provider = ""
  details.LockboxPremiumEDIPaymentExt = true
  details.OfferNumber = offerNumber
  return details
}

function updateAPPInformation(enroll : boolean){
  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    policyPeriod = getPolicyPeriod()
    policyPeriod = bundle.add(policyPeriod)
    var contact = policyPeriod.Account.Contacts.first().Contact
    //ContactUtil.getContactByPartyUUID("1231994", bundle)
    if( enroll ){
      process(PaymentInstrumentFactory.getImmutableAPPPI(), contact, PolicyPeriodRole.TC_AUTHORIZEDPAYEREXT)
      print("Enrolled")
    }
    else{
      process(PaymentInstrumentFactory.getImmutableCashPI() , contact, null)
      print("Unenrolled")
    }
  },activeUser)
}

function process(payInst : PaymentInstrument, contact : Contact, role : PolicyPeriodRole){
  policyPeriod.PaymentInstrument = payInst
  policyPeriod.AutoPayPayerExt =  contact
  policyPeriod.updateRoleOnContact(contact, role)
}

function makeSuspensePayment() {
  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    var a = bundle.add( AccountDAO.getAccountByAccountNumber(acctNumber) )
    var dbmr = DirectBillPaymentFactory.createDirectBillMoneyRcvd(a, PaymentInstrumentFactory.getImmutableCheckPI(),new MonetaryAmount(premAmount+" usd"))
    var qNumber = offerNumber
    dbmr.PaymentMatcherExt = qNumber
    dbmr.PaymentRequest = null
    // NRF DEFPD00079889 - Adding RefNumber and TransactionNumber to DBMR
    dbmr.RefNumber = ""
    dbmr.TransactionNumExt = ""
    // AJH DEFPD00064859 - Updating DBMR accounting date
    AccountingDateHelper.updateBMRAccountDateExt(dbmr)
    var dbp = DirectBillPaymentFactory.createDirectBillPayment(dbmr)
    var suspItem = dbp.createAndAddSuspDistItem()
    suspItem.GrossAmountToApply  = dbmr.Amount
    suspItem.PolicyNumber = ""
    // AJH DEFPD00087989 - Updating BNRDI accounting date
    AccountingDateHelper.updateBaseNonRecDistItemAccountingDate(suspItem)
    dbp.execute()
  }, activeUser )
}

function makeDirectBillPayment(moneyDetails : PaymentReceiptRecord, account : Account){
  //MW Defect 72508 - This will create the DBMR two different ways based on the Policy Period. If the policy period is null it will create an account level dbmr
  //else it will create a policy level dbmr. We then set the corresponding fields to there correct value so that it displays properly on the UI
  account = gw.transaction.Transaction.getCurrent().add(account)
  //var directBillMoneyDetails = toEntity(moneyDetails)
  var dbmr : DirectBillMoneyRcvd

  if( policyPeriod == null ){
    dbmr = DirectBillPaymentFactory.createDirectBillMoneyRcvd(account, PaymentInstrumentFactory.getImmutableCashPI() , new MonetaryAmount(premAmount +" usd"))
  }else{
    dbmr = DirectBillPaymentFactory.createDirectBillMoneyRcvdWithPolicyPeriod(account, PaymentInstrumentFactory.getImmutableCashPI(), new MonetaryAmount(premAmount +" usd"), policyPeriod)
  }

  //dbmr.DBPmntDistributionContext = typekey.DBPmntDistributionContext.TC_INTEGRATIONPAYMENTEXT

  //DEFPD00078238-NRF-The functions used to created DBMRS doesn't utilizing the
  //PaymentReceipt so we have to add in the missing fields
  dbmr.RefNumber = moneyDetails.RefNumber
  dbmr.Description = moneyDetails.Description
  dbmr.PaymentPayorExt = moneyDetails.Payor
  dbmr.PaymentProviderExt = moneyDetails.Provider
  dbmr.PaymentBatchIdExt = moneyDetails.BatchID
  dbmr.LockboxPremiumEDIPaymentExt = moneyDetails.LockboxPremiumEDIPaymentExt
  dbmr#DBPmntDistributionContextExt.set(DBPmntDistributionContext.TC_INTEGRATIONPAYMENTEXT)
  //dbmr.PolicyPeriod = find( pp in PolicyPeriod where pp.PolicyNumberLong == moneyDetails.PolicyNumber ).first()

  dbmr.distribute()
}


function getPolicyExpirationDate(date : Date) : XmlDateTime {
  if( policyTermType == PolicyPeriodTermTypeExt.TC_HALFYEAR.Code ){
    return UDEUtil.formatToXmlDate(date.addMonths(6))
  }
  else if( policyTermType == PolicyPeriodTermTypeExt.TC_OTHERSIXMONTH.Code ){
    return UDEUtil.formatToXmlDate(date.addMonths(4))
  }
  return UDEUtil.formatToXmlDate(date.addYears(1))
}

function createServiceProvider(){
  gw.transaction.Transaction.runWithNewBundle(\ bundle -> {
    var l_account = new AccountCreationUtil(bundle).createMortgageeListBillAccount()
    print(l_account.AccountNumber)
  }, activeUser)
}

function buildChargeInfo(date : Date) : List<BillingInstructionInfo_ChargeInfos>{
  var bis : List<BillingInstructionInfo_ChargeInfos> = new ArrayList<BillingInstructionInfo_ChargeInfos>()
  var d = date == null ? DateUtil.currentDate() : date
  for( item in list ){

    var breakDown = item.split(",")
    var pattern = breakDown[0]
    var amount = breakDown[1]

    var bi  = new BillingInstructionInfo_ChargeInfos()
    bi.Amount = amount + " usd"
    bi.setChargePatternCode(pattern)
    bi.ChargeEffDateExt = UDEUtil.formatToXmlDate(d)
    bi.OOSEChargeIndExt = isOOSE
    bis.add(bi)
  }
  return bis
}

function addKeysAndValueToChargeMap(keyAndValues : String[]){
  for( item in keyAndValues ){
    var breakDown = item.split(",")
    var key = breakDown[0]
    var value = breakDown[1]

    if( map.containsKey(key) ){
      print("Key and Value exisit. Replacing ${map.get(key)} with ${value}")
      map.put(key, new BigDecimal(value))
    }
    else{
      map.put(key, new BigDecimal(value))
    }
  }
}

function addItemsToList(items : String[]){
  for( item in items ){
    list.add( item )
  }
}

function buildCharge(chargePattern : String, amount : String) : String{
  return chargePattern + "," + amount
}

function createDBMRWithSuspenseItem() {
  var dbmr : entity.DirectBillMoneyRcvd
  try {
    var impl = new BillingPaymentImpl()
    var request = new CashCheckPaymentRequest(){
      :PaymentMethod="Check",
      :InvDayOfMonth="17",
      :Amount=new BigDecimal("100.00"),
      :Q_Number="Q12345",
      :AccountNumber="N100020003"
    }
    //impl.addCashCheckPayment(request)
    print("Done")
    print("SUCCESS BITCHES")
  } catch(e : Exception) {
    print("ERROR YOU FUCKED UP")
    e.printStackTrace()
  }
}

function createAccountVIAPCAccountInfo() : PCAccountInfo {
  var info = new PCAccountInfo()
  info.AccountNumber = acctNumber
  info.AccountName = "Michael Testing Woloski"
  info.BoJCountyExt = "054"
  info.BoJStateExt = "RI"
  info.FirstInsuredYearExt = DateUtil.currentDate().YearOfDate.toString()
  info.InvoiceDayOfMonthExt = DateUtil.currentDate().DayOfMonth
  info.PrintName1Ext = "Michael Woloski"

  //TODO: Upgrade the following
  info.InsuredContact = new PCAccountInfo_InsuredContact(){
    :PublicID = "abc:6154",
    :ContactType = "person",
    :FirstName = "Michael",
    :LastName = "Woloski" ,
    :AccountNumbers = {acctNumber},
    :PartyUUIDExt = 1231994,
    :ConsistencyMarkerExt = DateUtil.currentDate().toString()
  }

  return info
}

function readUncashedCheckRecords() : List<OutgoingDisbPmnt> {
  //getLogger().log(Level.INFO, CLASS_STRING, "readRecords()","Started fetching records..",null)
  var unCashedChecks = Query.make(OutgoingDisbPmnt).compare(OutgoingDisbPmnt#Status.PropertyInfo.Name, Equals, OutgoingPaymentStatus.TC_ISSUED)
      .compare(OutgoingDisbPmnt#IssueDate, NotEquals, null )
      .compare(OutgoingDisbPmnt#IssueDate, LessThanOrEquals, gw.api.util.DateUtil.currentDate().addYears(-1))
      .compare(OutgoingDisbPmnt#IsCheckProcessedExt, Equals, false)
      .join(OutgoingDisbPmnt#PaymentInstrument)
      .compare(PaymentInstrument#PaymentMethod, Equals, PaymentMethod.TC_CHECK).select()
  //getLogger().log(Level.INFO, CLASS_STRING, "readRecords()","End fetching records..",null)
  return unCashedChecks.toList()
}

function spongebobMeme( str : String ){
  var b : StringBuilder = new StringBuilder()
  var index = 0
  var splitString = str.split(" ")
  for( s in splitString ){
    var charArray = s.toCharArray()
    for( c in charArray ){
      build(c, index, b)
      index++
    }
    b.append(" ")
  }
  print( b )
}

function build( c : char, i : int, b : StringBuilder ){
  var str = new String(c)
  if( i % 2 == 1 ){
    str = str.toUpperCase()
  }
  b.append( str )
}

function buildCashCheckRequest() : CashCheckPaymentRequest {
  var request = new CashCheckPaymentRequest()
  request.AccountNumber = acctNumber
  request.Q_Number = offerNumber
  request.Amount = new BigDecimal(premAmount)
  request.PaymentMethod = "Cash"
  request.InvDayOfMonth = String.valueOf(idm)
  return request
}









