i want to create internal tool for our company ,
this tool is website that handle our emplyess and projects.
so basically in dashboard there is 10 main fetureas (tabs)

1.) Home
2.)Projects
3.)Tasks
4.)Work Logs
5.)Performance
6.)Settings
7.)Inquiries
8.)Meetings
9.)Proposal
10.)Profile

but currently i only need this 3 Tabs for now.

Inquiries
Reminders
Proposal


Inquiries Tab

so first Feature what is Inquiries tab - Inquiries tab means when cutomer call our comapny 
we get there name, number and there projects , thier needs that stuff and store in our DB for 
our Future advantages and for better management. 
so in inquiries tab i want like huge table 
it shows Customer name ,phone number ,Short Description ,Status and proposel.
so some one click in one raw anywhere it should open that customer record , but some one click on Status it will trigger option menu that can 
use to change status if we add new Inquiries , it show NEW as a default then we can change this status NEW , Proposel SENT, Negotiating , CONFIRMED and Lost
and also need to add down arrow on all status that help for better visul.
and next colum is proposal , in that colom have box name Create proposal, when some one create Inquiries first time that should be default in proposla tab.
but after some one create propsal that box should be change to Download Proposal, and once again ge create more than one propsal for same inqurie it change to Proposal list and when click it it should open drop down menu and show all the proposal as a list.
and also that tab have add New inquiries button serch bar and sort and filter.
and if i click New inquiries button it should open pop up screen to add new inquiries.
	in that screen this field should include
		1. Customer Name
		2. Phone Number
		3. Project Description
		4. Required Features (this can add requirement as separate Features )
		5. Internal Notes
after creating new Inquiries, it directly go that table, in that table,
 if i select any raw it will open curent customer record as a new screen.
in that screen it shows that details we enter when creating new Inquiries.
All project details Description,Required Features,Internal Notes,names etc. , and also 
it have Edit Inquiries , Delete Inquiries buttons and also it have Create Proposal and Add Meeting buttons.
and also each cutomer record have Proposel button, Default it show create Propsal but if we alredy create praposal it should show Download Praposal insted
this is basically all Inquiries Tab.

Then Proposal Tab.

This tab have first Create New proposl button(This same button in Inquiries tab table if user not create propsal to new Inquiries this button show in that table and also in Inquiries table if we select one user and view there recrod it also show this same button) if we click it it open pop up screen , in that screen first fiel is 
select Inquiries - this field allows users to select Inquiries that we create in Inquiries tab(because all proposel linked with Inquiries).so it contain serchbar as well.
Next Field is Project Name- we can give name to this project(This is normal text box),
Milestones-you can add Milestones give it name and add time(optional) and Time(Optional) {Milstone have 3 Text box title,amount and time and have +mark that can add any milstone each have 3 text box like before},
Deployment, Maintain & Publication (optional)-This is optional field (This also have 3 text box , for Title cost and description){and aslo have + mark that can add those 3 text field multiple time like Milestones },
Total_Price- Last one is Total Price it have To 3 text box Advance pay , Project pay, Total Price (Total price is auto genarate when they add Advance pay+ Project pay = Total price ) ,like that 
then have create Proposal , cancel and view demo buttons(If user click View demo it will open in another field)
after create proposal it should show in proposal tab main table ,
this tab have same like Table that cantail all detail that create proporsal cutomer name ,Price (Rs.),Created Date and download proposal button and also have delete button.
and also some one click raw in this tab it will view proposal record , in that it will show Customer Name,Project Description,Required Features,Total cost for development,Maintain & Server cost per month,Milestones (Customer Name,Project Description and Required Features should get in Inquiries tab) and also have edit button.

Meetings tab

this tab allow us to create meetings reminders. as metion before in Inquiries tab view cutomer record have Add Meeting button and also this tab also contain add Meeting button both are same. when this click come small pop up screen that cantain Title , Discription , date and time cacel and save button, after create new mmeting 
it goes to table like other 2 tabs , in this table have meeting Title,discription, time and date , status (when first create meeting it show as schedule , after time is over it auto change to overdue and also it has more status Done , cacel and postpone), and also have delete and edit button